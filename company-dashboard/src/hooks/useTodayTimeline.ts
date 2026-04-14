import { useEffect, useMemo, useState } from 'react'
import { checkCalendarAuth, fetchCalendarEvents } from '@/lib/calendarApi'
import type { Task } from '@/types/tasks'

// ── Types ──

export interface TimelineEvent {
  type: 'event'
  id: string
  title: string
  startTime: string
  endTime: string
  location?: string | null
  hangoutLink?: string | null
  isPast: boolean
}

export interface TimelineTask {
  type: 'task'
  id: string
  title: string
  /** scheduled_at or deadline_at — whichever places it on the timeline */
  time: string
  isDeadline: boolean
  estimatedMinutes: number | null
  completed: boolean
  isPast: boolean
  task: Task
}

export type TimelineItem = TimelineEvent | TimelineTask

export interface TimeSlot {
  time: string  // "09:00", "09:30", ...
  items: TimelineItem[]
}

export interface TodayTimeline {
  /** 30-min slots that have items */
  slots: TimeSlot[]
  /** Tasks due today but with no specific time */
  todayTasks: Task[]
  /** Tasks with deadline in next 7 days (not today) */
  upcomingTasks: Task[]
  /** Calendar events for tomorrow (kept for briefing) */
  tomorrowEvents: TimelineEvent[]
  /** Most recently ended event name */
  recentEventName: string | null
  loading: boolean
  /**
   * Google Calendar auth status.
   * `null` = still checking, `true` = authenticated, `false` = needs sign-in.
   * Consumers should prompt sign-in instead of showing "free" when this is false.
   */
  calendarAuthenticated: boolean | null
}

// ── Helpers ──

function toJSTDateStr(d: Date): string {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

function toJSTHourMin(iso: string): string {
  if (!iso.includes('T')) return ''
  return new Date(iso).toLocaleTimeString('ja-JP', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tokyo',
  })
}

/** Round down to nearest 30-min slot: "09:17" -> "09:00", "09:45" -> "09:30" */
function toSlotKey(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const slotMin = m < 30 ? '00' : '30'
  return `${String(h).padStart(2, '0')}:${slotMin}`
}

// ── Hook ──

export function useTodayTimeline(allTasks: Task[], completedToday: Task[]): TodayTimeline {
  const [calEvents, setCalEvents] = useState<TimelineEvent[]>([])
  const [tomorrowEvents, setTomorrowEvents] = useState<TimelineEvent[]>([])
  const [recentEventName, setRecentEventName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [calendarAuthenticated, setCalendarAuthenticated] = useState<boolean | null>(null)

  const now = useMemo(() => new Date(), [])
  const todayStr = useMemo(() => toJSTDateStr(now), [now])

  // Fetch calendar events
  useEffect(() => {
    async function load() {
      try {
        const { authenticated } = await checkCalendarAuth()
        setCalendarAuthenticated(authenticated)
        if (!authenticated) { setLoading(false); return }

        const todayStart = new Date(now)
        todayStart.setHours(0, 0, 0, 0)
        const tomorrowEnd = new Date(todayStart)
        tomorrowEnd.setDate(tomorrowEnd.getDate() + 2)

        const events = await fetchCalendarEvents({
          timeMin: todayStart.toISOString(),
          timeMax: tomorrowEnd.toISOString(),
          maxResults: 30,
        })

        const seen = new Set<string>()
        const mapped: TimelineEvent[] = []
        for (const ev of events) {
          if (seen.has(ev.id)) continue
          seen.add(ev.id)
          mapped.push({
            type: 'event',
            id: ev.id,
            title: ev.summary,
            startTime: ev.start_time,
            endTime: ev.end_time,
            location: ev.location,
            hangoutLink: ev.hangoutLink,
            isPast: new Date(ev.end_time) < now,
          })
        }
        mapped.sort((a, b) => a.startTime.localeCompare(b.startTime))

        const tomorrowDate = new Date(todayStart)
        tomorrowDate.setDate(tomorrowDate.getDate() + 1)
        const tomorrowStr = toJSTDateStr(tomorrowDate)

        setCalEvents(mapped.filter((e) => e.startTime.startsWith(todayStr)))
        setTomorrowEvents(mapped.filter((e) => e.startTime.startsWith(tomorrowStr)))

        const pastEvents = mapped.filter((e) => e.startTime.startsWith(todayStr) && e.isPast)
        setRecentEventName(pastEvents.length > 0 ? pastEvents[pastEvents.length - 1].title : null)
      } catch {
        // Calendar auth check or event fetch failed — treat as unauthenticated
        // so the UI can prompt sign-in rather than silently showing "free".
        setCalendarAuthenticated(false)
      }
      setLoading(false)
    }
    load()
  }, [now, todayStr])

  // Merge calendar events + tasks into timeline
  return useMemo(() => {
    const slotMap = new Map<string, TimelineItem[]>()

    // Add calendar events to slots
    for (const ev of calEvents) {
      const hhmm = toJSTHourMin(ev.startTime)
      if (!hhmm) continue // skip all-day events from timeline slots
      const key = toSlotKey(hhmm)
      if (!slotMap.has(key)) slotMap.set(key, [])
      slotMap.get(key)!.push(ev)
    }

    // Categorize tasks
    const todayTasks: Task[] = []
    const upcomingTasks: Task[] = []

    const sevenDaysLater = new Date(now)
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)
    const sevenDaysStr = toJSTDateStr(sevenDaysLater)

    const completedIds = new Set(completedToday.map((t) => t.id))

    for (const task of allTasks) {
      // Task with specific time → timeline slot
      const timeField = task.scheduled_at || task.deadline_at
      if (timeField) {
        const taskDate = timeField.substring(0, 10)
        if (taskDate === todayStr) {
          const hhmm = toJSTHourMin(timeField)
          if (hhmm) {
            const key = toSlotKey(hhmm)
            if (!slotMap.has(key)) slotMap.set(key, [])
            slotMap.get(key)!.push({
              type: 'task',
              id: task.id,
              title: task.title,
              time: timeField,
              isDeadline: !!task.deadline_at && !task.scheduled_at,
              estimatedMinutes: task.estimated_minutes,
              completed: completedIds.has(task.id) || task.status === 'done',
              isPast: new Date(timeField) < now,
              task,
            })
            continue
          }
        }
      }

      // Task due today but no specific time → "today tasks" zone
      if (task.due_date === todayStr || (task.due_date && task.due_date < todayStr)) {
        todayTasks.push(task)
        continue
      }

      // Task with future deadline (next 7 days) → "upcoming" zone
      if (task.due_date && task.due_date > todayStr && task.due_date <= sevenDaysStr) {
        upcomingTasks.push(task)
        continue
      }

      // High priority or in_progress without date → also show in today tasks
      if (task.priority === 'high' || task.status === 'in_progress') {
        todayTasks.push(task)
      }
    }

    // Sort upcoming by due date
    upcomingTasks.sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))

    // Build sorted slot array (only slots with items)
    const slots: TimeSlot[] = Array.from(slotMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, items]) => ({
        time,
        items: items.sort((a, b) => {
          // Events before tasks within same slot
          if (a.type !== b.type) return a.type === 'event' ? -1 : 1
          return 0
        }),
      }))

    return { slots, todayTasks, upcomingTasks, tomorrowEvents, recentEventName, loading, calendarAuthenticated }
  }, [calEvents, allTasks, completedToday, tomorrowEvents, recentEventName, loading, calendarAuthenticated, now, todayStr])
}
