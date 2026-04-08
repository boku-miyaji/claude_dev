import { useCallback, useEffect, useState } from 'react'
import {
  checkCalendarAuth,
  startCalendarAuth,
  fetchCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from '@/lib/calendarApi'
import type { CalendarEvent, ViewMode } from '@/types/calendar'

export function useGoogleCalendar(viewDate: Date, viewMode: ViewMode) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)

  // Check auth status on mount
  useEffect(() => {
    checkCalendarAuth().then(({ authenticated: authed }) => {
      setAuthenticated(authed)
    })
  }, [])

  // Compute date range
  const getRange = useCallback((): [string, string] => {
    let start: Date
    let end: Date
    if (viewMode === 'day') {
      start = new Date(viewDate)
      end = new Date(viewDate)
      end.setDate(end.getDate() + 1)
    } else if (viewMode === 'week') {
      start = new Date(viewDate)
      end = new Date(viewDate)
      end.setDate(end.getDate() + 7)
    } else {
      start = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1)
      end = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1)
    }
    return [start.toISOString(), end.toISOString()]
  }, [viewDate, viewMode])

  // Fetch events
  const fetchEvents = useCallback(async () => {
    if (authenticated === false) { setLoading(false); return }
    setLoading(true)
    setError(null)

    try {
      const [timeMin, timeMax] = getRange()
      const items = await fetchCalendarEvents({ timeMin, timeMax })
      setEvents(items)
    } catch (e) {
      if (e instanceof Error && e.message === 'NEEDS_AUTH') {
        setAuthenticated(false)
      } else {
        setError(e instanceof Error ? e.message : 'Failed to fetch events')
      }
    }
    setLoading(false)
  }, [authenticated, getRange])

  useEffect(() => {
    if (authenticated === true) fetchEvents()
  }, [authenticated, fetchEvents])

  const requestAuth = useCallback(() => {
    startCalendarAuth()
  }, [])

  const createEvent = useCallback(async (calendarId: string, eventBody: Record<string, unknown>) => {
    return createCalendarEvent(calendarId, eventBody)
  }, [])

  const handleUpdateEvent = useCallback(async (calendarId: string, eventId: string, patch: Record<string, unknown>) => {
    return updateCalendarEvent(calendarId, eventId, patch)
  }, [])

  const handleDeleteEvent = useCallback(async (calendarId: string, eventId: string) => {
    return deleteCalendarEvent(calendarId, eventId)
  }, [])

  return {
    events,
    loading,
    error,
    token: authenticated ? 'proxy' : null,  // Backwards compat: truthy when authenticated
    requestAuth,
    refetch: fetchEvents,
    createEvent,
    updateEvent: handleUpdateEvent,
    deleteEvent: handleDeleteEvent,
  }
}
