import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * カレンダーに重ねるレイヤーのデータを日付別にまとめて取得するフック。
 * 日記・ハビッツ・気分を日付キー (YYYY-MM-DD JST) でマップ化する。
 *
 * Google Calendar の予定とタスクは既存の useGoogleCalendar / tasks フェッチで
 * 取得しているのでここでは扱わない。
 */

export interface DayLayerData {
  date: string              // YYYY-MM-DD
  mood: number | null       // 0-10 の気分スコア（diary_entries.wbi の日別平均）、nullなら不明
  diaryEntries: { id: number; body: string; created_at: string; wbi: number | null }[]
  habitTotals: { done: number; total: number }
  habitLogs: { habitId: number; habitTitle: string; done: boolean }[]
}

export type CalendarLayerMap = Map<string, DayLayerData>

interface HabitRow {
  id: number
  title: string
  frequency: string | null
  active: boolean | null
  created_at?: string
}

interface HabitLogRow {
  habit_id: number
  completed_at: string | null
}

interface DiaryRow {
  id: number
  body: string | null
  created_at: string
  wbi: number | null
}

function toJSTDateStr(iso: string): string {
  return new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function toDateStr(d: Date): string {
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(0, 10)
}

function buildDateRange(start: Date, end: Date): string[] {
  const out: string[] = []
  const cur = new Date(start)
  while (cur <= end) {
    out.push(toDateStr(cur))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return out
}

export function useCalendarLayers(startDate: Date, endDate: Date) {
  const [data, setData] = useState<CalendarLayerMap>(new Map())
  const [loading, setLoading] = useState(false)

  const startStr = toDateStr(startDate)
  const endStr = toDateStr(endDate)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    const startIso = new Date(`${startStr}T00:00:00+09:00`).toISOString()
    const endIso = new Date(`${endStr}T23:59:59+09:00`).toISOString()

    Promise.all([
      supabase
        .from('diary_entries')
        .select('id,body,wbi,created_at')
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .order('created_at', { ascending: true }),
      supabase
        .from('habits')
        .select('id,title,frequency,active,created_at'),
      supabase
        .from('habit_logs')
        .select('habit_id,completed_at')
        .gte('completed_at', startIso)
        .lte('completed_at', endIso),
    ])
      .then(([diaryRes, habitsRes, logsRes]) => {
        if (cancelled) return
        const diary = (diaryRes.data as DiaryRow[] | null) || []
        const habits = (habitsRes.data as HabitRow[] | null) || []
        const logs = (logsRes.data as HabitLogRow[] | null) || []

        // 日付ごとの初期マップを作る
        const map: CalendarLayerMap = new Map()
        for (const d of buildDateRange(startDate, endDate)) {
          map.set(d, {
            date: d,
            mood: null,
            diaryEntries: [],
            habitTotals: { done: 0, total: 0 },
            habitLogs: [],
          })
        }

        // Diary 集計
        const wbiSumByDate = new Map<string, { sum: number; count: number }>()
        for (const e of diary) {
          const ds = toJSTDateStr(e.created_at)
          const day = map.get(ds)
          if (!day) continue
          day.diaryEntries.push({ id: e.id, body: e.body || '', created_at: e.created_at, wbi: e.wbi })
          if (e.wbi != null) {
            const agg = wbiSumByDate.get(ds) || { sum: 0, count: 0 }
            agg.sum += e.wbi
            agg.count += 1
            wbiSumByDate.set(ds, agg)
          }
        }
        for (const [ds, agg] of wbiSumByDate) {
          const day = map.get(ds)
          if (day) day.mood = agg.count > 0 ? agg.sum / agg.count : null
        }

        // Habits 集計: 対象は active=true のハビッツのみ。
        // habit_logs の存在 = その日の達成（completed_at が JST のその日に入る）
        const logByDateHabit = new Map<string, Set<number>>()
        for (const l of logs) {
          if (!l.completed_at) continue
          const ds = toJSTDateStr(l.completed_at)
          if (!logByDateHabit.has(ds)) logByDateHabit.set(ds, new Set())
          logByDateHabit.get(ds)!.add(l.habit_id)
        }

        const activeHabits = habits.filter((h) => h.active !== false)

        for (const d of buildDateRange(startDate, endDate)) {
          const day = map.get(d)
          if (!day) continue
          // その日時点で作成されていたハビッツのみ対象
          const relevant = activeHabits.filter((h) => !h.created_at || toDateStr(new Date(h.created_at)) <= d)
          const doneSet = logByDateHabit.get(d) || new Set()
          day.habitTotals.total = relevant.length
          for (const h of relevant) {
            const done = doneSet.has(h.id)
            if (done) day.habitTotals.done += 1
            day.habitLogs.push({ habitId: h.id, habitTitle: h.title, done })
          }
        }

        setData(map)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startStr, endStr])

  return { data, loading }
}

/**
 * 気分スコア (0-10) を 5段階のレベル (1-5, 0=データなし) に変換。
 * カレンダーの背景色で使う。
 */
export function moodLevel(mood: number | null): 0 | 1 | 2 | 3 | 4 | 5 {
  if (mood == null) return 0
  if (mood >= 8) return 5
  if (mood >= 6.5) return 4
  if (mood >= 5) return 3
  if (mood >= 3) return 2
  return 1
}

export function moodBgColor(level: 0 | 1 | 2 | 3 | 4 | 5): string | undefined {
  switch (level) {
    case 5: return 'color-mix(in srgb, #22c55e 20%, var(--surface))'
    case 4: return 'color-mix(in srgb, #84cc16 18%, var(--surface))'
    case 3: return 'color-mix(in srgb, #eab308 16%, var(--surface))'
    case 2: return 'color-mix(in srgb, #f97316 20%, var(--surface))'
    case 1: return 'color-mix(in srgb, #ef4444 22%, var(--surface))'
    default: return undefined
  }
}

export function moodEmoji(level: 0 | 1 | 2 | 3 | 4 | 5): string {
  switch (level) {
    case 5: return '😊'
    case 4: return '🙂'
    case 3: return '😐'
    case 2: return '😕'
    case 1: return '😔'
    default: return '—'
  }
}
