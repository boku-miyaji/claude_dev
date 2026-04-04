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
  recentEventName: string | null  // most recently ended event
}

const TOKEN_KEY = 'gcal_token'

function toJST(date: Date): string {
  return date.toLocaleString('sv-SE', { timeZone: 'Asia/Tokyo' }).replace(' ', 'T')
}

/**
 * Lightweight hook to fetch today's and tomorrow's Google Calendar events
 * for the Today screen. Reuses the existing OAuth token from localStorage.
 * Caches for 15 minutes.
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
    const tomorrowStart = new Date(todayStart)
    tomorrowStart.setDate(tomorrowStart.getDate() + 1)
    const tomorrowEnd = new Date(tomorrowStart)
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1)

    const timeMin = toJST(todayStart)
    const timeMax = toJST(tomorrowEnd)

    async function fetchEvents() {
      const allEvents: ScheduleEvent[] = []

      for (const cal of GCAL_CALENDARS) {
        try {
          const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?timeMin=${timeMin}:00%2B09:00&timeMax=${timeMax}:00%2B09:00&singleEvents=true&orderBy=startTime&maxResults=20`
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
          })
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

      // Sort by start time
      unique.sort((a, b) => a.start.localeCompare(b.start))

      // Split into today and tomorrow
      const todayStr = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
      const tomorrowStr = tomorrowStart.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })

      const today = unique.filter((e) => e.start.startsWith(todayStr))
      const tomorrow = unique.filter((e) => e.start.startsWith(tomorrowStr))

      // Find most recently ended event (for context-aware diary prompt)
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
