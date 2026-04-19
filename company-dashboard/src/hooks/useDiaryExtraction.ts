import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { aiCompletion } from '@/lib/edgeAi'

export interface TaskDoneDetection {
  task_id: string
  task_title: string
  confidence: 'high' | 'medium' | 'low'
  quote: string
}

export type TaskTimeMode = 'deadline' | 'scheduled' | 'none'

export interface NewTaskSuggestion {
  title: string
  quote: string
  /** Recommended handling for this task. Inferred from title, quote, and past task patterns. */
  suggested_mode: TaskTimeMode
  /** YYYY-MM-DD. For 'deadline' it's the due date; for 'scheduled' it's the work date. */
  suggested_date: string | null
  /** HH:MM (JST). For 'deadline' it's the deadline time; for 'scheduled' it's the start time. */
  suggested_time: string | null
  /** Minutes of focused work. Only meaningful for 'scheduled'. */
  suggested_minutes: number | null
  /** Short Japanese rationale shown under the card (e.g. "過去の類似タスクは午前に30分で完了"). */
  reasoning: string
}

export interface HabitDoneDetection {
  habit_id: number
  habit_title: string
  confidence: 'high' | 'medium' | 'low'
  quote: string
}

export interface NewHabitSuggestion {
  title: string
  quote: string
}

export interface DiaryExtractionResult {
  done_tasks: TaskDoneDetection[]
  new_tasks: NewTaskSuggestion[]
  done_habits: HabitDoneDetection[]
  new_habit_suggestions: NewHabitSuggestion[]
}

const EMPTY: DiaryExtractionResult = { done_tasks: [], new_tasks: [], done_habits: [], new_habit_suggestions: [] }

interface UseDiaryExtractionReturn {
  extract: (diaryContent: string) => Promise<DiaryExtractionResult>
  extracting: boolean
}

/**
 * Extract actionable items from a diary entry:
 *  - completed tasks (match against open tasks)
 *  - new tasks implied by the diary
 *  - completed habits (match against active habits)
 *  - new habit suggestions
 *
 * High-confidence completions are intended for auto-check by the caller.
 * Medium/low and "new" items are suggestions that require user confirmation.
 */
export function useDiaryExtraction(): UseDiaryExtractionReturn {
  const [extracting, setExtracting] = useState(false)

  const extract = useCallback(async (diaryContent: string): Promise<DiaryExtractionResult> => {
    const body = diaryContent.trim()
    if (!body) return EMPTY

    setExtracting(true)
    try {
      // Fetch in parallel:
      //   - open tasks to match completions against
      //   - active habits to match habit completions
      //   - recent tasks (any status) to infer time patterns for new-task suggestions
      const sixtyDaysAgo = new Date()
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
      const [tasksRes, habitsRes, recentRes] = await Promise.all([
        supabase
          .from('tasks')
          .select('id, title')
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(40),
        supabase
          .from('habits')
          .select('id, title')
          .eq('active', true)
          .limit(40),
        supabase
          .from('tasks')
          .select('title, scheduled_at, deadline_at, due_date, estimated_minutes')
          .gte('created_at', sixtyDaysAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(60),
      ])

      const openTasks = (tasksRes.data ?? []) as { id: string; title: string }[]
      const activeHabits = (habitsRes.data ?? []) as { id: number; title: string }[]
      const recentTasks = (recentRes.data ?? []) as {
        title: string
        scheduled_at: string | null
        deadline_at: string | null
        due_date: string | null
        estimated_minutes: number | null
      }[]

      // If there's no state to match against, skip the LLM call entirely
      if (openTasks.length === 0 && activeHabits.length === 0) {
        setExtracting(false)
        return EMPTY
      }

      const taskList = openTasks.map((t) => `- ID:${t.id} "${t.title}"`).join('\n') || '(なし)'
      const habitList = activeHabits.map((h) => `- ID:${h.id} "${h.title}"`).join('\n') || '(なし)'

      // Compact past-pattern summary: one line per task, showing how the user typically handles it.
      // Only include tasks that had some kind of time signal — pure untimed tasks teach the LLM nothing.
      const patternList = recentTasks
        .filter((t) => t.scheduled_at || t.deadline_at || t.due_date)
        .slice(0, 30)
        .map((t) => {
          const parts: string[] = [`"${t.title}"`]
          if (t.scheduled_at) {
            const d = new Date(t.scheduled_at)
            parts.push(`作業=${d.toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })}`)
          }
          if (t.deadline_at) {
            const d = new Date(t.deadline_at)
            parts.push(`締切=${d.toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })}`)
          } else if (t.due_date) {
            parts.push(`締切日=${t.due_date}`)
          }
          if (t.estimated_minutes) parts.push(`${t.estimated_minutes}分`)
          return `- ${parts.join(' / ')}`
        })
        .join('\n') || '(データなし)'

      const now = new Date()
      const todayStr = now.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', timeZone: 'Asia/Tokyo' })
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = tomorrow.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', timeZone: 'Asia/Tokyo' })

      const systemPrompt = `ユーザーの日記から、既存のタスク・習慣の完了、および新規タスク・新規習慣候補を抽出してください。

## 原則
- 確信が持てる言及だけ返す（confidence=high）。曖昧なら medium、かすかなら low
- 過剰検出は害。タスクへの単なる言及（「A社の件」）は完了ではない。「A社の件、連絡した」「やった」「終わった」等、完了を示す語が必要
- 新規タスクは「〜しないと」「明日〜する」など将来のアクションのみ。単なる愚痴や状況描写は除外
- 習慣は「走った」「ストレッチした」のような実行の明示的記述のみ
- quote には日記本文の該当箇所を短く引用（10-30字）

## 新規タスクの時間推論（重要）

各 new_task に対して、最適な扱い方を推論する:

### mode の選び方
- **"deadline"**: いつまでに終わらせるかが重要なタスク。提出物・返信・外部依存。
  - 日記に「〇日までに」「来週までに」「今週中」などの期限語がある
  - 過去の類似タスクが deadline で管理されている
- **"scheduled"**: まとまった作業時間を確保すべきタスク。資料作成・コーディング・読書など。
  - 30分以上の集中作業が必要
  - 過去の類似タスクに scheduled_at と estimated_minutes がある
- **"none"**: いつやってもよい軽い雑務・TODO。
  - 短時間で片付く、期限もない

### 日時の推論ルール
- 日記に明示された日時（「明日14時」「金曜まで」）があれば必ずそれを使う
- 過去パターンに類似タスクがあれば、その時間帯・所要時間を参考にする（例: 過去の「レポート作成」が平均90分なら 90）
- 「明日〜する」→ suggested_date = 明日
- 「今日中に」→ suggested_date = 今日
- 不明なときは suggested_date = 今日、時刻は作業ブロックなら午前10時をデフォルト
- reasoning に根拠を10-30字で書く（例: "過去の類似タスクは午前に30分", "明日に言及あり"）

## 出力JSON
{
  "done_tasks": [{ "task_id": "既存ID", "confidence": "high|medium|low", "quote": "日記の該当箇所" }],
  "new_tasks": [{
    "title": "短いタスク名",
    "quote": "日記の該当箇所",
    "suggested_mode": "deadline|scheduled|none",
    "suggested_date": "YYYY-MM-DD または null",
    "suggested_time": "HH:MM または null",
    "suggested_minutes": 数値または null,
    "reasoning": "10-30字の根拠"
  }],
  "done_habits": [{ "habit_id": 既存ID, "confidence": "high|medium|low", "quote": "日記の該当箇所" }],
  "new_habit_suggestions": [{ "title": "短い習慣名", "quote": "日記の該当箇所" }]
}

該当がないフィールドは空配列で。JSON 以外は返さないでください。`

      const userMessage = `## 今日
${todayStr}（明日: ${tomorrowStr}）

## 日記
${body}

## 既存のオープンなタスク
${taskList}

## 既存のアクティブな習慣
${habitList}

## 過去60日のタスク運用パターン（類推に使う）
${patternList}`

      const { content } = await aiCompletion(userMessage, {
        source: 'diary_extraction',
        systemPrompt,
        model: 'claude-opus-4-7',
        jsonMode: true,
        temperature: 0.2,
        maxTokens: 1200,
      })

      if (!content) {
        setExtracting(false)
        return EMPTY
      }

      // Extract JSON (Opus may wrap in prose despite instruction)
      const match = content.match(/\{[\s\S]*\}/)
      if (!match) {
        setExtracting(false)
        return EMPTY
      }

      type ParsedNewTask = {
        title?: string
        quote?: string
        suggested_mode?: string
        suggested_date?: string | null
        suggested_time?: string | null
        suggested_minutes?: number | null
        reasoning?: string
      }
      const parsed = JSON.parse(match[0]) as Partial<DiaryExtractionResult> & { new_tasks?: ParsedNewTask[] }

      // Enrich with titles for UI display
      const done_tasks: TaskDoneDetection[] = (parsed.done_tasks ?? []).map((d) => {
        const t = openTasks.find((x) => String(x.id) === String(d.task_id))
        return {
          task_id: String(d.task_id),
          task_title: t?.title ?? '(不明なタスク)',
          confidence: d.confidence ?? 'low',
          quote: d.quote ?? '',
        }
      }).filter((d) => d.task_title !== '(不明なタスク)')

      const done_habits: HabitDoneDetection[] = (parsed.done_habits ?? []).map((d) => {
        const h = activeHabits.find((x) => x.id === Number(d.habit_id))
        return {
          habit_id: Number(d.habit_id),
          habit_title: h?.title ?? '(不明な習慣)',
          confidence: d.confidence ?? 'low',
          quote: d.quote ?? '',
        }
      }).filter((d) => d.habit_title !== '(不明な習慣)')

      // Defensive normalization for suggested_* fields — the LLM can return stray formats.
      const todayYmd = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' }) // YYYY-MM-DD
      const new_tasks: NewTaskSuggestion[] = (parsed.new_tasks ?? [])
        .map((n) => {
          const title = (n.title ?? '').trim()
          if (!title) return null
          const modeRaw = (n.suggested_mode ?? 'none').toString().toLowerCase()
          const mode: TaskTimeMode = modeRaw === 'deadline' || modeRaw === 'scheduled' ? modeRaw : 'none'
          const date = typeof n.suggested_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(n.suggested_date) ? n.suggested_date : (mode !== 'none' ? todayYmd : null)
          const time = typeof n.suggested_time === 'string' && /^\d{2}:\d{2}$/.test(n.suggested_time) ? n.suggested_time : (mode === 'scheduled' ? '10:00' : null)
          const minutes = typeof n.suggested_minutes === 'number' && n.suggested_minutes > 0 ? Math.round(n.suggested_minutes) : (mode === 'scheduled' ? 30 : null)
          return {
            title,
            quote: n.quote ?? '',
            suggested_mode: mode,
            suggested_date: date,
            suggested_time: time,
            suggested_minutes: minutes,
            reasoning: (n.reasoning ?? '').toString().slice(0, 60),
          } satisfies NewTaskSuggestion
        })
        .filter((n): n is NewTaskSuggestion => n !== null)

      const result: DiaryExtractionResult = {
        done_tasks,
        new_tasks,
        done_habits,
        new_habit_suggestions: (parsed.new_habit_suggestions ?? []).map((n) => ({ title: n.title ?? '', quote: n.quote ?? '' })).filter((n) => n.title),
      }

      setExtracting(false)
      return result
    } catch (err) {
      console.error('[useDiaryExtraction] error', err)
      setExtracting(false)
      return EMPTY
    }
  }, [])

  return { extract, extracting }
}
