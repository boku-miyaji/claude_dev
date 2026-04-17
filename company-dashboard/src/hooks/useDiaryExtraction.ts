import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { aiCompletion } from '@/lib/edgeAi'

export interface TaskDoneDetection {
  task_id: string
  task_title: string
  confidence: 'high' | 'medium' | 'low'
  quote: string
}

export interface NewTaskSuggestion {
  title: string
  quote: string
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
      const [tasksRes, habitsRes] = await Promise.all([
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
      ])

      const openTasks = (tasksRes.data ?? []) as { id: string; title: string }[]
      const activeHabits = (habitsRes.data ?? []) as { id: number; title: string }[]

      // If there's no state to match against, skip the LLM call entirely
      if (openTasks.length === 0 && activeHabits.length === 0) {
        setExtracting(false)
        return EMPTY
      }

      const taskList = openTasks.map((t) => `- ID:${t.id} "${t.title}"`).join('\n') || '(なし)'
      const habitList = activeHabits.map((h) => `- ID:${h.id} "${h.title}"`).join('\n') || '(なし)'

      const systemPrompt = `ユーザーの日記から、既存のタスク・習慣の完了、および新規タスク・新規習慣候補を抽出してください。

## 原則
- 確信が持てる言及だけ返す（confidence=high）。曖昧なら medium、かすかなら low
- 過剰検出は害。タスクへの単なる言及（「A社の件」）は完了ではない。「A社の件、連絡した」「やった」「終わった」等、完了を示す語が必要
- 新規タスクは「〜しないと」「明日〜する」など将来のアクションのみ。単なる愚痴や状況描写は除外
- 習慣は「走った」「ストレッチした」のような実行の明示的記述のみ
- quote には日記本文の該当箇所を短く引用（10-30字）

## 出力JSON
{
  "done_tasks": [{ "task_id": "既存ID", "confidence": "high|medium|low", "quote": "日記の該当箇所" }],
  "new_tasks": [{ "title": "短いタスク名", "quote": "日記の該当箇所" }],
  "done_habits": [{ "habit_id": 既存ID, "confidence": "high|medium|low", "quote": "日記の該当箇所" }],
  "new_habit_suggestions": [{ "title": "短い習慣名", "quote": "日記の該当箇所" }]
}

該当がないフィールドは空配列で。JSON 以外は返さないでください。`

      const userMessage = `## 日記\n${body}\n\n## 既存のオープンなタスク\n${taskList}\n\n## 既存のアクティブな習慣\n${habitList}`

      const { content } = await aiCompletion(userMessage, {
        source: 'diary_extraction',
        systemPrompt,
        model: 'claude-opus-4-7',
        jsonMode: true,
        temperature: 0.2,
        maxTokens: 800,
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

      const parsed = JSON.parse(match[0]) as Partial<DiaryExtractionResult>

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

      const result: DiaryExtractionResult = {
        done_tasks,
        new_tasks: (parsed.new_tasks ?? []).map((n) => ({ title: n.title ?? '', quote: n.quote ?? '' })).filter((n) => n.title),
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
