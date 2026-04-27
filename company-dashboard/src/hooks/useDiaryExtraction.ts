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

/**
 * 日記から検出された「新しい夢の種」候補。
 * 「〜したい」「〜できたらいいな」「いつか〜」のような中長期の願望が
 * 繰り返し / 強く語られている時に抽出する。タスクや習慣にできない、
 * もっと抽象的・長期的なもの。
 */
export interface NewDreamSuggestion {
  title: string
  quote: string
  /** life / work / learning / relationship / creative / other */
  category: string
}

/**
 * A concrete travel/transit mention that warrants a real-time lookup
 * (departure times, route, fare) via the trip-lookup Edge Function.
 *
 * Example: diary says "明日始発で下田" → one TripLookup with
 * origin=home_station, destination="下田", when="明日始発".
 */
export interface TripLookup {
  /** Short quote from the diary (10-30 chars). */
  quote: string
  /** Station / city name. Null means "use user's home_station". */
  origin: string | null
  /** Station / city name. */
  destination: string
  /** Free-text time hint ("明日始発", "土曜の夕方", "今夜22時発" etc). */
  when: string
  /** Why this warranted surfacing (e.g. "明日の朝イチで動く予定あり"). */
  reasoning: string
}

/**
 * A soft, emotion-driven wish surfaced from the diary that isn't actionable as a task yet.
 * We suggest 2-3 concrete candidates to help the user concretize it.
 *
 * Example: diary says "旅行行きたい" → one MoodSuggestion with topic=trip
 * and candidates like [熱海1泊, 白馬3泊, 沖縄].
 */
export interface MoodSuggestion {
  /** Short quote from the diary. */
  quote: string
  topic: 'trip' | 'meal' | 'activity' | 'rest' | 'other'
  /** One-liner about why this triggered (mood, season, past patterns). */
  reasoning: string
  candidates: Array<{
    /** Short label shown on the card button. */
    title: string
    /** 1-2 sentence description. */
    description: string
  }>
}

export interface DiaryExtractionResult {
  done_tasks: TaskDoneDetection[]
  new_tasks: NewTaskSuggestion[]
  done_habits: HabitDoneDetection[]
  new_habit_suggestions: NewHabitSuggestion[]
  new_dream_suggestions: NewDreamSuggestion[]
  trip_lookups: TripLookup[]
  mood_suggestions: MoodSuggestion[]
}

const EMPTY: DiaryExtractionResult = {
  done_tasks: [],
  new_tasks: [],
  done_habits: [],
  new_habit_suggestions: [],
  new_dream_suggestions: [],
  trip_lookups: [],
  mood_suggestions: [],
}

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
      //   - user_settings for profile-driven trip/mood suggestions
      //   - calendar events for the next 7 days (schedule-aware work block suggestions)
      const sixtyDaysAgo = new Date()
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
      const sevenDaysLater = new Date()
      sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)
      const [tasksRes, habitsRes, recentRes, profileRes, calendarRes] = await Promise.all([
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
        supabase
          .from('user_settings')
          .select('home_station, home_area, home_address, birth_year, family_structure, chat_occupation, hobbies, travel_style, food_preferences, budget_note, health_notes, basic_info_freetext')
          .maybeSingle(),
        supabase
          .from('calendar_events')
          .select('summary, start_time, end_time, all_day, calendar_type')
          .gte('start_time', new Date().toISOString())
          .lte('start_time', sevenDaysLater.toISOString())
          .neq('status', 'cancelled')
          .order('start_time', { ascending: true })
          .limit(20),
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
      const profile = (profileRes.data ?? {}) as Record<string, string | number | null>
      const calendarEvents = (calendarRes.data ?? []) as {
        summary: string
        start_time: string
        end_time: string
        all_day: boolean
        calendar_type: string
      }[]

      // Keep running if the diary has meaningful content — trip/mood suggestions work
      // without any tasks or habits, so we only bail when the diary itself is too short.
      if (body.length < 10 && openTasks.length === 0 && activeHabits.length === 0) {
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

      const calendarList = calendarEvents.length > 0
        ? calendarEvents.map((e) => {
            if (e.all_day) {
              const d = new Date(e.start_time)
              const label = d.toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit', weekday: 'short', timeZone: 'Asia/Tokyo' })
              return `- ${label} 終日 ${e.summary}`
            }
            const start = new Date(e.start_time)
            const end = new Date(e.end_time)
            const startLabel = start.toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
            const endLabel = end.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
            // calendar_type は primary/secondary だけになったので、業務判定は summary prefix で。
            // ハードコード（旧: acesinc.co.jp など）に依存しない portable な判定。
            const isWork = /^\[仕事\]|^\[Ex|^\[In|^\[in\]/i.test(e.summary || '')
            const typeTag = isWork ? '[仕事]' : '[個人]'
            return `- ${startLabel}〜${endLabel} ${typeTag} ${e.summary}`
          }).join('\n')
        : '(なし)'

      const now = new Date()
      const todayStr = now.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', timeZone: 'Asia/Tokyo' })
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = tomorrow.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', timeZone: 'Asia/Tokyo' })
      const season = (() => {
        const m = now.getMonth() + 1
        if (m >= 3 && m <= 5) return '春'
        if (m >= 6 && m <= 8) return '夏'
        if (m >= 9 && m <= 11) return '秋'
        return '冬'
      })()

      const profileLines: string[] = []
      const p = profile as {
        home_station?: string | null
        home_area?: string | null
        home_address?: string | null
        birth_year?: number | null
        family_structure?: string | null
        chat_occupation?: string | null
        hobbies?: string | null
        travel_style?: string | null
        food_preferences?: string | null
        budget_note?: string | null
        health_notes?: string | null
        basic_info_freetext?: string | null
      }
      if (p.home_station) profileLines.push(`- 最寄り駅: ${p.home_station}`)
      if (p.home_area) profileLines.push(`- エリア: ${p.home_area}`)
      if (p.home_address) profileLines.push(`- 住所: ${p.home_address}`)
      if (p.birth_year) profileLines.push(`- 生まれ年: ${p.birth_year}（${now.getFullYear() - Number(p.birth_year)}歳）`)
      if (p.chat_occupation) profileLines.push(`- 職業: ${p.chat_occupation}`)
      if (p.family_structure) profileLines.push(`- 家族: ${p.family_structure}`)
      if (p.hobbies) profileLines.push(`- 趣味: ${p.hobbies}`)
      if (p.travel_style) profileLines.push(`- 旅行スタイル: ${p.travel_style}`)
      if (p.food_preferences) profileLines.push(`- 食の好み: ${p.food_preferences}`)
      if (p.budget_note) profileLines.push(`- 予算感: ${p.budget_note}`)
      if (p.health_notes) profileLines.push(`- 健康メモ: ${p.health_notes}`)
      if (p.basic_info_freetext) profileLines.push(`- その他: ${p.basic_info_freetext}`)
      const profileText = profileLines.join('\n') || '(未登録 — 提案は一般的な粒度になる)'
      const profileKnown = profileLines.length > 0

      const systemPrompt = `ユーザーの日記から、既存のタスク・習慣の完了／新規タスク・習慣候補／具体化提案（乗換）／気分連想提案（旅行・食事など）を抽出してください。

## 原則
- 確信が持てる言及だけ返す（confidence=high）。曖昧なら medium、かすかなら low
- 過剰検出は害。タスクへの単なる言及（「A社の件」）は完了ではない。「A社の件、連絡した」「やった」「終わった」等、完了を示す語が必要
- 新規タスクは「〜しないと」「明日〜する」など将来のアクションのみ。単なる愚痴や状況描写は除外
- 習慣は「走った」「ストレッチした」のような実行の明示的記述のみ
- 新しい夢候補は「いつか〜したい」「〜できたらいいな」のような中長期の願望（タスクより抽象的・遠い時間軸）。日常的願望は除外
- quote には日記本文の該当箇所を短く引用（10-30字）

## 新規タスクの時間推論

各 new_task に対して、最適な扱い方を推論する:

### mode の選び方
- **"deadline"**: 締切が重要なタスク（提出・返信・外部依存）。日記に「〇日までに」等の期限語や、過去の類似タスクが deadline 運用ならこちら
- **"scheduled"**: まとまった作業時間を確保すべきタスク（資料作成・コーディング・読書）。30分以上の集中が必要ならこちら
- **"none"**: いつやってもよい軽い雑務・TODO。日時が全く読み取れない場合もここ

### 日時の推論ルール（重要: 推論できない場合は無理に埋めない）
- 日記に明示された日時（「明日14時」「金曜まで」）があれば必ずそれを使う
- 過去パターンに類似タスクがあれば、その時間帯・所要時間を参考にする
- 「明日〜する」→ suggested_date = 明日。「今日中に」→ 今日
- **mode="none" の場合、suggested_date/time/minutes は null にする**（日付不明なら未定のまま）
- mode="scheduled" で時刻が不明な場合: スケジュールの空き時間から推薦（なければ10:00）
- mode="deadline" で日付が不明な場合: null のまま（無理に今日にしない）
- reasoning に根拠を10-30字（例: "過去の類似タスクは午前に30分" / "明日14時のMTG前に"）

### スケジュールを考慮した作業ブロック提案
- 既存スケジュールに空き時間があれば、そこに作業ブロックを提案する
- MTG・予定の直前30分・直後は避ける（準備・余韻を考慮）
- 深夜（22時〜7時）は提案しない
- 既存スケジュールが詰まっている日は別の日を提案してもよい

## 具体化提案（trip_lookups）

日記に「移動・旅行・訪問の予定」が具体的に示唆されていて、**出発時刻・ルート・運賃を調べる価値がある**場合に抽出する。

例:
- 「明日始発で下田」→ origin=(最寄り駅 or null), destination="下田", when="明日始発"
- 「土曜京都行く」→ destination="京都", when="土曜"
- 「19時から渋谷で飲み」→ destination="渋谷", when="今日19時"（出発時刻逆算用）

### 抽出条件
- 行き先が明確（駅名・地名・店名）
- 時刻の示唆がある（"明日朝", "始発", "19時", "土曜" 等）
- 単なる思考・願望（「京都いいなぁ」）は除外。実際に行く予定の記述のみ

### origin
- ユーザーが出発地を明示していなければ null（= ユーザー最寄り駅を採用）

## 気分連想提案（mood_suggestions）

日記に「願望・疲れ・気分・季節感」が表れていて、まだタスク化されていない場合に、具体化を助ける候補を2-3個出す。

### トピック分類
- **trip**: 「旅行行きたい」「温泉」「遠くに行きたい」
- **meal**: 「美味しいもの食べたい」「ラーメン」「お寿司」
- **activity**: 「体動かしたい」「映画見たい」「散歩」
- **rest**: 「休みたい」「何もしたくない」「ぼーっとしたい」
- **other**: 上記以外（買い物、イベント等）

### 候補の質
- **プロフィール情報が登録されている**: 趣味・予算・スタイル・所在地に合わせて**具体名**で提案（店名・地名・商品名）
- **未登録**: 一般的な粒度（「近場の温泉」「海辺のカフェ」等）でOK
- 必ず2-3個出す。1つだと選択肢にならない
- 季節（${season}）と曜日感覚を反映する

### 禁止
- 単なる共感で終わらない（「わかる〜」だけはダメ）
- 日記に無い提案（「旅行」って書いてないのに旅行提案）は禁止
- トピックが見つからなければ空配列

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
  "new_habit_suggestions": [{ "title": "短い習慣名", "quote": "日記の該当箇所" }],
  "new_dream_suggestions": [{
    "title": "短い夢のタイトル（〜したい / 〜になりたい）",
    "quote": "日記の該当箇所",
    "category": "life|work|learning|relationship|creative|other"
  }],
  "trip_lookups": [{
    "quote": "日記の該当箇所",
    "origin": "駅名 または null",
    "destination": "駅名・地名",
    "when": "いつ（自由記述）",
    "reasoning": "10-30字の根拠"
  }],
  "mood_suggestions": [{
    "quote": "日記の該当箇所",
    "topic": "trip|meal|activity|rest|other",
    "reasoning": "10-30字の根拠",
    "candidates": [
      { "title": "短いラベル", "description": "1-2文の説明" }
    ]
  }]
}

該当がないフィールドは空配列で。JSON 以外は返さないでください。`

      const userMessage = `## 今日
${todayStr}（明日: ${tomorrowStr}、季節: ${season}）

## 日記
${body}

## ユーザーの基本情報${profileKnown ? '' : '（未登録 — 提案は一般的な粒度に）'}
${profileText}

## 既存のオープンなタスク
${taskList}

## 既存のアクティブな習慣
${habitList}

## 過去60日のタスク運用パターン（類推に使う）
${patternList}

## 今後7日のスケジュール（作業ブロック提案の参考に）
${calendarList}`

      const { content } = await aiCompletion(userMessage, {
        source: 'diary_extraction',
        systemPrompt,
        model: 'claude-opus-4-7',
        jsonMode: true,
        temperature: 0.3,
        maxTokens: 2500,
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
      type ParsedTripLookup = {
        quote?: string
        origin?: string | null
        destination?: string
        when?: string
        reasoning?: string
      }
      type ParsedMoodSuggestion = {
        quote?: string
        topic?: string
        reasoning?: string
        candidates?: Array<{ title?: string; description?: string }>
      }
      const parsed = JSON.parse(match[0]) as Partial<DiaryExtractionResult> & {
        new_tasks?: ParsedNewTask[]
        trip_lookups?: ParsedTripLookup[]
        mood_suggestions?: ParsedMoodSuggestion[]
      }

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

      const trip_lookups: TripLookup[] = (parsed.trip_lookups ?? [])
        .map((t) => {
          const destination = (t.destination ?? '').trim()
          if (!destination) return null
          return {
            quote: (t.quote ?? '').toString(),
            origin: typeof t.origin === 'string' && t.origin.trim() ? t.origin.trim() : null,
            destination,
            when: (t.when ?? '').toString(),
            reasoning: (t.reasoning ?? '').toString().slice(0, 60),
          } satisfies TripLookup
        })
        .filter((t): t is TripLookup => t !== null)

      const validTopics: MoodSuggestion['topic'][] = ['trip', 'meal', 'activity', 'rest', 'other']
      const mood_suggestions: MoodSuggestion[] = (parsed.mood_suggestions ?? [])
        .map((m) => {
          const topicRaw = (m.topic ?? 'other').toString().toLowerCase()
          const topic = (validTopics as string[]).includes(topicRaw) ? (topicRaw as MoodSuggestion['topic']) : 'other'
          const candidates = (m.candidates ?? [])
            .map((c) => ({ title: (c.title ?? '').toString().trim(), description: (c.description ?? '').toString().trim() }))
            .filter((c) => c.title)
          if (candidates.length === 0) return null
          return {
            quote: (m.quote ?? '').toString(),
            topic,
            reasoning: (m.reasoning ?? '').toString().slice(0, 60),
            candidates,
          } satisfies MoodSuggestion
        })
        .filter((m): m is MoodSuggestion => m !== null)

      const validDreamCategories = ['life', 'work', 'learning', 'relationship', 'creative', 'other']
      const new_dream_suggestions: NewDreamSuggestion[] = ((parsed as Partial<DiaryExtractionResult>).new_dream_suggestions ?? [])
        .map((n) => {
          const title = (n?.title ?? '').toString().trim()
          if (!title) return null
          const cat = (n?.category ?? 'other').toString().toLowerCase()
          return {
            title,
            quote: (n?.quote ?? '').toString(),
            category: validDreamCategories.includes(cat) ? cat : 'other',
          } satisfies NewDreamSuggestion
        })
        .filter((n): n is NewDreamSuggestion => n !== null)

      const result: DiaryExtractionResult = {
        done_tasks,
        new_tasks,
        done_habits,
        new_habit_suggestions: (parsed.new_habit_suggestions ?? []).map((n) => ({ title: n.title ?? '', quote: n.quote ?? '' })).filter((n) => n.title),
        new_dream_suggestions,
        trip_lookups,
        mood_suggestions,
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
