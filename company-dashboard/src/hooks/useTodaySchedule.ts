import { useEffect, useState } from 'react'
import { GCAL_CALENDARS } from '@/lib/constants'

interface ScheduleEvent {
  id: string
  summary: string
  start: string  // ISO datetime
  end: string
  location?: string
  hangoutLink?: string
  isPast: boolean
}

interface TodaySchedule {
  todayEvents: ScheduleEvent[]
  tomorrowEvents: ScheduleEvent[]
  loading: boolean
  recentEventName: string | null
}

const TOKEN_KEY = 'gcal_token'

/**
 * Lightweight hook to fetch today's and tomorrow's Google Calendar events.
 * Uses the same API pattern as useGoogleCalendar (URLSearchParams + timeZone).
 */
export function useTodaySchedule(): TodaySchedule {
  const [todayEvents, setTodayEvents] = useState<ScheduleEvent[]>([])
  const [tomorrowEvents, setTomorrowEvents] = useState<ScheduleEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [recentEventName, setRecentEventName] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setLoading(false)
      return
    }

    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const tomorrowEnd = new Date(todayStart)
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 2)

    async function fetchEvents() {
      const allEvents: ScheduleEvent[] = []

      const params = new URLSearchParams({
        timeMin: todayStart.toISOString(),
        timeMax: tomorrowEnd.toISOString(),
        timeZone: 'Asia/Tokyo',
        singleEvents: 'true',
        maxResults: '20',
        orderBy: 'startTime',
      })

      for (const cal of GCAL_CALENDARS) {
        try {
          const res = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?${params}`,
            { headers: { Authorization: `Bearer ${token}` } },
          )
          if (!res.ok) continue
          const data = await res.json()
          for (const item of data.items || []) {
            if (item.status === 'cancelled') continue
            const start = item.start?.dateTime || item.start?.date || ''
            const end = item.end?.dateTime || item.end?.date || ''
            allEvents.push({
              id: item.id,
              summary: item.summary || '(無題)',
              start,
              end,
              location: item.location,
              hangoutLink: item.hangoutLink,
              isPast: new Date(end) < now,
            })
          }
        } catch { /* skip calendar on error */ }
      }

      // Deduplicate by id
      const seen = new Set<string>()
      const unique = allEvents.filter((e) => {
        if (seen.has(e.id)) return false
        seen.add(e.id)
        return true
      })
      unique.sort((a, b) => a.start.localeCompare(b.start))

      // Split into today and tomorrow
      const todayStr = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
      const tomorrowDate = new Date(todayStart)
      tomorrowDate.setDate(tomorrowDate.getDate() + 1)
      const tomorrowStr = tomorrowDate.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })

      const today = unique.filter((e) => e.start.startsWith(todayStr))
      const tomorrow = unique.filter((e) => e.start.startsWith(tomorrowStr))

      // Most recently ended event (for diary prompt context)
      const pastEvents = today.filter((e) => e.isPast)
      const recent = pastEvents.length > 0 ? pastEvents[pastEvents.length - 1].summary : null

      setTodayEvents(today)
      setTomorrowEvents(tomorrow)
      setRecentEventName(recent)
      setLoading(false)
    }

    fetchEvents()
  }, [])

  return { todayEvents, tomorrowEvents, loading, recentEventName }
}
