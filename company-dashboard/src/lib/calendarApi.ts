import { supabase } from '@/lib/supabase'
import { GCAL_CALENDARS } from '@/lib/constants'
import type { CalendarEvent, CalendarType } from '@/types/calendar'

const PROXY_BASE = import.meta.env.VITE_SUPABASE_URL + '/functions/v1/google-calendar-proxy'

// Google OAuth authorization code flow URL
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GCAL_SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/tasks'

/** Get the Google Client ID from env or constants fallback */
function getClientId(): string {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID || '855851839827-hfijpvgal6m3hgrjgus6bdf8it8ibr9h.apps.googleusercontent.com'
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token || ''
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
  }
}

// ============================================================
// Auth
// ============================================================

/** Check if user has stored Google Calendar credentials (cached for 5 min) */
let _authCache: { result: boolean; ts: number } | null = null
export async function checkCalendarAuth(): Promise<{ authenticated: boolean }> {
  // Cache auth check for 5 minutes to reduce requests
  if (_authCache && Date.now() - _authCache.ts < 300_000) {
    return { authenticated: _authCache.result }
  }
  const headers = await getAuthHeaders()
  const res = await fetch(`${PROXY_BASE}/auth/check`, { headers })
  if (!res.ok) {
    _authCache = { result: false, ts: Date.now() }
    return { authenticated: false }
  }
  const data = await res.json()
  _authCache = { result: data.authenticated, ts: Date.now() }
  return data
}
/** Invalidate auth cache (call after OAuth flow completes) */
export function invalidateCalendarAuthCache(): void {
  _authCache = null
}

/**
 * Start Google OAuth authorization code flow.
 * Redirects the browser to Google's consent page.
 */
export function startCalendarAuth(): void {
  const redirectUri = window.location.origin + '/auth/google/callback'
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GCAL_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state: 'gcal_auth',
  })
  window.location.href = `${GOOGLE_AUTH_URL}?${params}`
}

/**
 * Complete the OAuth flow by sending the authorization code to the Edge Function.
 * Called from the callback page after Google redirects back.
 */
export async function completeCalendarAuth(code: string): Promise<{ ok: boolean; error?: string }> {
  const headers = await getAuthHeaders()
  const redirectUri = window.location.origin + '/auth/google/callback'
  const res = await fetch(`${PROXY_BASE}/auth/callback`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      code,
      redirect_uri: redirectUri,
      calendar_ids: GCAL_CALENDARS.map((c) => c.id),
    }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Unknown error' }))
    return { ok: false, error: data.error }
  }
  return { ok: true }
}

// ============================================================
// Events
// ============================================================

interface FetchEventsOptions {
  timeMin: string  // ISO datetime
  timeMax: string  // ISO datetime
  calendarIds?: string[]
  maxResults?: number
}

interface ProxyEvent {
  id: string
  calendar_id: string
  summary: string
  start_time: string
  end_time: string
  all_day: boolean
  status?: string
  location?: string | null
  hangoutLink?: string | null
}

/** Fetch events from Google Calendar via Edge Function proxy */
export async function fetchCalendarEvents(options: FetchEventsOptions): Promise<CalendarEvent[]> {
  const headers = await getAuthHeaders()
  const calIds = options.calendarIds || GCAL_CALENDARS.map((c) => c.id)
  const params = new URLSearchParams({
    calendar_ids: calIds.join(','),
    time_min: options.timeMin,
    time_max: options.timeMax,
    max_results: String(options.maxResults || 50),
  })

  const res = await fetch(`${PROXY_BASE}/events?${params}`, { headers })

  if (res.status === 401) {
    const data = await res.json().catch(() => ({}))
    if (data.error === 'NEEDS_AUTH') {
      throw new Error('NEEDS_AUTH')
    }
  }

  if (!res.ok) throw new Error(`Calendar API error: ${res.status}`)

  const data: { events: ProxyEvent[] } = await res.json()

  // Map calendar_id to calendar_type
  const calMap = new Map(GCAL_CALENDARS.map((c) => [c.id, c.type]))

  return data.events.map((ev) => ({
    id: ev.id,
    calendar_id: ev.calendar_id,
    calendar_type: (calMap.get(ev.calendar_id) || 'primary') as CalendarType,
    summary: ev.summary,
    start_time: ev.start_time,
    end_time: ev.end_time,
    all_day: ev.all_day,
    status: ev.status,
    location: ev.location,
    hangoutLink: ev.hangoutLink,
  }))
}

/** Create a new calendar event */
export async function createCalendarEvent(
  calendarId: string,
  event: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${PROXY_BASE}/events`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ calendar_id: calendarId, event }),
  })
  if (!res.ok) throw new Error(`Create event failed: ${res.status}`)
  return res.json()
}

/** Update an existing calendar event */
export async function updateCalendarEvent(
  calendarId: string,
  eventId: string,
  patch: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${PROXY_BASE}/events`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ calendar_id: calendarId, event_id: eventId, patch }),
  })
  if (!res.ok) throw new Error(`Update event failed: ${res.status}`)
  return res.json()
}

/** Delete a calendar event */
export async function deleteCalendarEvent(
  calendarId: string,
  eventId: string,
): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${PROXY_BASE}/events`, {
    method: 'DELETE',
    headers,
    body: JSON.stringify({ calendar_id: calendarId, event_id: eventId }),
  })
  if (!res.ok) throw new Error(`Delete event failed: ${res.status}`)
}
