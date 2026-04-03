import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface WeeklyNarrativeRecord {
  id: number
  week_start: string
  week_end: string
  narrative: string
  stats: {
    diary_count?: number
    task_count?: number
    avg_wbi?: number
    dominant_emotion?: string
    dream_changes?: number
    goal_progress?: number
  }
  created_at: string
}

export interface WeekInfo {
  weekStart: string
  weekEnd: string
  weekNumber: number
  label: string
  narrative: WeeklyNarrativeRecord | null
}

/**
 * Get the Monday of the week for a given date.
 */
function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getWeekNumber(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1)
  const days = Math.floor((d.getTime() - start.getTime()) / 86400000)
  return Math.ceil((days + start.getDay() + 1) / 7)
}

const PLUTCHIK_KEYS = ['joy', 'trust', 'fear', 'surprise', 'sadness', 'disgust', 'anger', 'anticipation'] as const

interface UseWeeklyNarrativeReturn {
  weeks: WeekInfo[]
  loading: boolean
  generating: boolean
  error: string | null
  generate: (weekStart: string, weekEnd: string) => Promise<WeeklyNarrativeRecord | null>
}

// NOTE: API key is sent from client for simplicity in personal use.
// For production/multi-user, move to Supabase Edge Function.

/**
 * Hook for weekly narrative reports.
 * Lists past 6 weeks and their narratives; generates new ones with OpenAI.
 */
export function useWeeklyNarrative(): UseWeeklyNarrativeReturn {
  const [weeks, setWeeks] = useState<WeekInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)

    // Build list of past 6 weeks
    const today = new Date()
    const weekList: { start: string; end: string; num: number }[] = []
    for (let i = 0; i < 6; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i * 7)
      const mon = getMonday(d)
      const sun = new Date(mon)
      sun.setDate(sun.getDate() + 6)
      weekList.push({
        start: formatDate(mon),
        end: formatDate(sun),
        num: getWeekNumber(mon),
      })
    }

    // Fetch existing narratives
    const starts = weekList.map((w) => w.start)
    const { data: narratives } = await supabase
      .from('weekly_narratives')
      .select('*')
      .in('week_start', starts)
      .order('week_start', { ascending: false })

    const narrativeMap = new Map<string, WeeklyNarrativeRecord>()
    if (narratives) {
      for (const n of narratives) {
        narrativeMap.set(n.week_start, n as WeeklyNarrativeRecord)
      }
    }

    const weekInfos: WeekInfo[] = weekList.map((w, i) => ({
      weekStart: w.start,
      weekEnd: w.end,
      weekNumber: w.num,
      label: i === 0 ? '今週' : i === 1 ? '先週' : `${i}週前`,
      narrative: narrativeMap.get(w.start) ?? null,
    }))

    setWeeks(weekInfos)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const generate = useCallback(async (weekStart: string, weekEnd: string): Promise<WeeklyNarrativeRecord | null> => {
    setGenerating(true)
    setError(null)

    try {
      // Get API key
      const { data: settings } = await supabase
        .from('user_settings')
        .select('openai_api_key')
        .single()

      if (!settings?.openai_api_key) {
        setError('OpenAI API keyが設定されていません。')
        setGenerating(false)
        return null
      }

      const startTs = `${weekStart}T00:00:00`
      const endTs = `${weekEnd}T23:59:59`

      // Collect week data in parallel
      const [diaryRes, emotionRes, taskRes, goalRes] = await Promise.all([
        supabase
          .from('diary_entries')
          .select('body, created_at')
          .gte('created_at', startTs)
          .lte('created_at', endTs)
          .order('created_at'),
        supabase
          .from('emotion_analysis')
          .select('joy, trust, fear, surprise, sadness, disgust, anger, anticipation, wbi_score, created_at')
          .gte('created_at', startTs)
          .lte('created_at', endTs),
        supabase
          .from('tasks')
          .select('title, status, completed_at')
          .gte('completed_at', startTs)
          .lte('completed_at', endTs),
        supabase
          .from('goals')
          .select('title, progress, status')
          .order('created_at', { ascending: false })
          .limit(10),
      ])

      const diaries = diaryRes.data ?? []
      const emotions = emotionRes.data ?? []
      const completedTasks = taskRes.data ?? []
      const goals = goalRes.data ?? []

      // Calculate stats
      let avgWbi = 0
      let dominantEmotion = 'joy'
      if (emotions.length > 0) {
        const totals: Record<string, number> = {}
        let wbiSum = 0
        for (const e of emotions) {
          const rec = e as Record<string, number>
          wbiSum += rec.wbi_score ?? 0
          for (const key of PLUTCHIK_KEYS) {
            totals[key] = (totals[key] ?? 0) + (rec[key] ?? 0)
          }
        }
        avgWbi = wbiSum / emotions.length
        let maxVal = 0
        for (const key of PLUTCHIK_KEYS) {
          if ((totals[key] ?? 0) > maxVal) {
            maxVal = totals[key] ?? 0
            dominantEmotion = key
          }
        }
      }

      const stats = {
        diary_count: diaries.length,
        task_count: completedTasks.length,
        avg_wbi: Math.round(avgWbi * 10) / 10,
        dominant_emotion: dominantEmotion,
      }

      // Build data text for AI
      const diaryText = diaries
        .map((d: { body: string; created_at: string }) => `[${d.created_at.substring(0, 10)}] ${d.body.substring(0, 200)}`)
        .join('\n')
      const taskText = completedTasks
        .map((t: { title: string }) => `- ${t.title}`)
        .join('\n')
      const goalText = goals
        .map((g: { title: string; progress: number; status: string }) => `- ${g.title} (${g.progress}%, ${g.status})`)
        .join('\n')

      const userData = [
        `## 期間: ${weekStart} - ${weekEnd}`,
        `## 日記 (${diaries.length}件)`,
        diaryText || '(なし)',
        `## 完了タスク (${completedTasks.length}件)`,
        taskText || '(なし)',
        `## ゴール進捗`,
        goalText || '(なし)',
        `## 感情データ`,
        `WBI平均: ${stats.avg_wbi}`,
        `優勢感情: ${dominantEmotion}`,
      ].join('\n\n')

      const systemPrompt = `以下のデータから、ユーザーの1週間を温かく振り返るナラティブを200-300字で書いてください。
- 達成したことを具体的に褒める
- 感情の変化に触れる
- 来週への穏やかな提案を1つ添える
- 他者比較は絶対にしない
- 「〜でした」「〜ですね」の丁寧な口調
テキストのみ返してください。JSONではなく純粋なテキストです。`

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.openai_api_key}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userData },
          ],
          max_tokens: 600,
          temperature: 0.7,
        }),
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`)
      }

      const data = await response.json()
      const narrative = data.choices?.[0]?.message?.content?.trim()
      if (!narrative) throw new Error('Empty response from OpenAI')

      // Save to DB
      const { data: inserted, error: insertErr } = await supabase
        .from('weekly_narratives')
        .insert({
          week_start: weekStart,
          week_end: weekEnd,
          narrative,
          stats,
        })
        .select()
        .single()

      if (insertErr) throw new Error(insertErr.message)

      const record = inserted as WeeklyNarrativeRecord

      // Update local state
      setWeeks((prev) =>
        prev.map((w) =>
          w.weekStart === weekStart ? { ...w, narrative: record } : w,
        ),
      )

      setGenerating(false)
      return record
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      setGenerating(false)
      return null
    }
  }, [])

  return { weeks, loading, generating, error, generate }
}
