import { useEffect, useState } from 'react'
import { checkCalendarAuth, fetchCalendarEvents } from '@/lib/calendarApi'

interface ScheduleEvent {
  id: string
  summary: string
  start: string  // ISO datetime
  end: string
  location?: string | null
  hangoutLink?: string | null
  isPast: boolean
}

interface TodaySchedule {
  todayEvents: ScheduleEvent[]
  tomorrowEvents: ScheduleEvent[]
  loading: boolean
  recentEventName: string | null
}

/**
 * Lightweight hook to fetch today's and tomorrow's Google Calendar events.
 * Uses the shared calendarApi (Edge Function proxy) — no direct Google API calls.
 */
export function useTodaySchedule(): TodaySchedule {
  const [todayEvents, setTodayEvents] = useState<ScheduleEvent[]>([])
  const [tomorrowEvents, setTomorrowEvents] = useState<ScheduleEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [recentEventName, setRecentEventName] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { authenticated } = await checkCalendarAuth()
      if (!authenticated) {
        setLoading(false)
        return
      }

      const now = new Date()
      const todayStart = new Date(now)
      todayStart.setHours(0, 0, 0, 0)
      const tomorrowEnd = new Date(todayStart)
      tomorrowEnd.setDate(tomorrowEnd.getDate() + 2)

      try {
        const events = await fetchCalendarEvents({
          timeMin: todayStart.toISOString(),
          timeMax: tomorrowEnd.toISOString(),
          maxResults: 20,
        })

        // Map to ScheduleEvent and deduplicate
        const seen = new Set<string>()
        const mapped: ScheduleEvent[] = []
        for (const ev of events) {
          if (seen.has(ev.id)) continue
          seen.add(ev.id)
          mapped.push({
            id: ev.id,
            summary: ev.summary,
            start: ev.start_time,
            end: ev.end_time,
            location: ev.location,
            hangoutLink: ev.hangoutLink,
            isPast: new Date(ev.end_time) < now,
          })
        }
        mapped.sort((a, b) => a.start.localeCompare(b.start))

        // Split into today and tomorrow
        const todayStr = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
        const tomorrowDate = new Date(todayStart)
        tomorrowDate.setDate(tomorrowDate.getDate() + 1)
        const tomorrowStr = tomorrowDate.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })

        const today = mapped.filter((e) => e.start.startsWith(todayStr))
        const tomorrow = mapped.filter((e) => e.start.startsWith(tomorrowStr))

        // Most recently ended event (for diary prompt context)
        const pastEvents = today.filter((e) => e.isPast)
        const recent = pastEvents.length > 0 ? pastEvents[pastEvents.length - 1].summary : null

        setTodayEvents(today)
        setTomorrowEvents(tomorrow)
        setRecentEventName(recent)
      } catch {
        // Calendar not available — silently skip
      }
      setLoading(false)
    }

    load()
  }, [])

  return { todayEvents, tomorrowEvents, loading, recentEventName }
}
