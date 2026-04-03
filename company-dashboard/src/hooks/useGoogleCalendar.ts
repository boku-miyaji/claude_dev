import { useCallback, useEffect, useRef, useState } from 'react'
import { GCAL_CLIENT_ID, GCAL_SCOPES, GCAL_CALENDARS } from '@/lib/constants'
import type { CalendarEvent, ViewMode } from '@/types/calendar'

const TOKEN_KEY = 'gcal_token'
const TOKEN_TIME_KEY = 'gcal_token_time'

interface GoogleTokenClient {
  requestAccessToken: (opts?: { prompt?: string }) => void
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: Record<string, unknown>) => GoogleTokenClient
        }
      }
    }
  }
}

function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function useGoogleCalendar(viewDate: Date, viewMode: ViewMode) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(getStoredToken)
  const clientRef = useRef<GoogleTokenClient | null>(null)
  const callbackRef = useRef<(() => void) | null>(null)

  // Initialize Google token client
  useEffect(() => {
    function tryInit() {
      if (!window.google?.accounts?.oauth2) {
        setTimeout(tryInit, 300)
        return
      }
      clientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: GCAL_CLIENT_ID,
        scope: GCAL_SCOPES,
        prompt: '',
        callback: (resp: { error?: string; access_token?: string }) => {
          if (resp.error || !resp.access_token) return
          localStorage.setItem(TOKEN_KEY, resp.access_token)
          localStorage.setItem(TOKEN_TIME_KEY, String(Date.now()))
          setToken(resp.access_token)
          callbackRef.current?.()
        },
      })
    }
    tryInit()
  }, [])

  // Compute date range
  const getRange = useCallback((): [Date, Date] => {
    if (viewMode === 'day') {
      const end = new Date(viewDate)
      end.setDate(end.getDate() + 1)
      return [viewDate, end]
    } else if (viewMode === 'week') {
      const end = new Date(viewDate)
      end.setDate(end.getDate() + 7)
      return [viewDate, end]
    } else {
      const start = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1)
      const end = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1)
      return [start, end]
    }
  }, [viewDate, viewMode])

  // Fetch events
  const fetchEvents = useCallback(async () => {
    const t = token || getStoredToken()
    if (!t) { setLoading(false); return }
    setLoading(true)
    setError(null)

    const [rangeStart, rangeEnd] = getRange()
    const allEvents: CalendarEvent[] = []

    for (const cal of GCAL_CALENDARS) {
      try {
        const params = new URLSearchParams({
          timeMin: rangeStart.toISOString(),
          timeMax: rangeEnd.toISOString(),
          timeZone: 'Asia/Tokyo',
          singleEvents: 'true',
          maxResults: '50',
          orderBy: 'startTime',
        })
        const resp = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?${params}`,
          { headers: { Authorization: `Bearer ${t}` } },
        )
        if (resp.status === 401) {
          // Token expired — try silent refresh
          localStorage.removeItem(TOKEN_KEY)
          setToken(null)
          if (clientRef.current) {
            clientRef.current.requestAccessToken({ prompt: '' })
          }
          setLoading(false)
          return
        }
        if (!resp.ok) continue
        const data = await resp.json()
        for (const ev of data.items || []) {
          allEvents.push({
            id: ev.id,
            calendar_id: cal.id,
            calendar_type: cal.type,
            summary: ev.summary || '(No title)',
            start_time: ev.start.dateTime || ev.start.date,
            end_time: ev.end.dateTime || ev.end.date,
            all_day: !ev.start.dateTime,
            status: ev.status,
          })
        }
      } catch {
        // skip failed calendar
      }
    }

    allEvents.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    setEvents(allEvents)
    setLoading(false)
  }, [token, getRange])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const requestAuth = useCallback(() => {
    if (clientRef.current) {
      callbackRef.current = fetchEvents
      clientRef.current.requestAccessToken({ prompt: 'consent' })
    }
  }, [fetchEvents])

  const createEvent = useCallback(async (calendarId: string, eventBody: Record<string, unknown>) => {
    const t = token || getStoredToken()
    if (!t) throw new Error('Not authenticated')
    const resp = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      { method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify(eventBody) },
    )
    if (!resp.ok) throw new Error(`Create failed: ${resp.status}`)
    return resp.json()
  }, [token])

  const updateEvent = useCallback(async (calendarId: string, eventId: string, patch: Record<string, unknown>) => {
    const t = token || getStoredToken()
    if (!t) throw new Error('Not authenticated')
    const resp = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { method: 'PATCH', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify(patch) },
    )
    if (!resp.ok) throw new Error(`Update failed: ${resp.status}`)
    return resp.json()
  }, [token])

  const deleteEvent = useCallback(async (calendarId: string, eventId: string) => {
    const t = token || getStoredToken()
    if (!t) throw new Error('Not authenticated')
    const resp = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${t}` } },
    )
    if (!resp.ok && resp.status !== 204) throw new Error(`Delete failed: ${resp.status}`)
  }, [token])

  return { events, loading, error, token, requestAuth, refetch: fetchEvents, createEvent, updateEvent, deleteEvent }
}
