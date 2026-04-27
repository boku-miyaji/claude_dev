import { useCallback, useEffect, useState } from 'react'
import {
  checkCalendarAuth,
  startCalendarAuth,
  fetchCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from '@/lib/calendarApi'
import type { FailedCalendar, UserCalendar } from '@/lib/calendarApi'
import type { CalendarEvent, ViewMode } from '@/types/calendar'
import { useUserCalendars } from './useUserCalendars'

export function useGoogleCalendar(viewDate: Date, viewMode: ViewMode) {
  const { calendars: userCalendars, loading: calendarsLoading } = useUserCalendars()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [failedCalendars, setFailedCalendars] = useState<FailedCalendar[]>([])
  const [partial, setPartial] = useState(false)

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
    if (userCalendars.length === 0) { setLoading(false); return }
    setLoading(true)
    setError(null)

    try {
      const [timeMin, timeMax] = getRange()
      const calendarIds = userCalendars.map((c) => c.id)
      const result = await fetchCalendarEvents({ timeMin, timeMax, calendarIds })
      setEvents(result.events)
      setFailedCalendars(result.failedCalendars)
      setPartial(result.partial)
    } catch (e) {
      if (e instanceof Error && e.message === 'NEEDS_AUTH') {
        setAuthenticated(false)
      } else {
        setError(e instanceof Error ? e.message : 'Failed to fetch events')
      }
    }
    setLoading(false)
  }, [authenticated, getRange, userCalendars])

  useEffect(() => {
    if (authenticated === true && !calendarsLoading) fetchEvents()
  }, [authenticated, calendarsLoading, fetchEvents])

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
    authenticated,
    failedCalendars,
    partial,
    token: authenticated ? 'proxy' : null,  // Backwards compat: truthy when authenticated
    requestAuth,
    refetch: fetchEvents,
    createEvent,
    updateEvent: handleUpdateEvent,
    deleteEvent: handleDeleteEvent,
    /** Logged-in user's writable calendars (Google calendarList). */
    userCalendars,
  }
}

export type { UserCalendar }
