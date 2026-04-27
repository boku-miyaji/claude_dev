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

/**
 * Get a Supabase access_token that is guaranteed fresh.
 * If the cached session is within 60s of expiry (or already expired),
 * refresh it first. Returns an empty string only if the user has no
 * session at all (unauthenticated).
 */
async function getFreshAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return ''
  const expiresAt = session.expires_at ? session.expires_at * 1000 : 0
  const needsRefresh = expiresAt - Date.now() < 60_000
  if (needsRefresh) {
    const { data, error } = await supabase.auth.refreshSession()
    if (error || !data.session) return ''
    return data.session.access_token
  }
  return session.access_token
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getFreshAccessToken()
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
  }
}

/**
 * Fetch wrapper that refreshes the Supabase session and retries once
 * on 401. This covers the case where the token expired between the
 * last getSession() call and the actual request landing on the server.
 */
export async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = { ...(init.headers as Record<string, string> | undefined), ...(await getAuthHeaders()) }
  const res = await fetch(input, { ...init, headers })
  if (res.status !== 401) return res
  // One-shot retry after forcing a refresh
  const { data, error } = await supabase.auth.refreshSession()
  if (error || !data.session) return res
  const retryHeaders = {
    ...(init.headers as Record<string, string> | undefined),
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${data.session.access_token}`,
    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
  }
  return fetch(input, { ...init, headers: retryHeaders })
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
  const res = await authedFetch(`${PROXY_BASE}/auth/check`)
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
  // Wait up to 3s for the Supabase session to be restored after the OAuth
  // redirect (React may still be hydrating when this runs).
  let { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    session = await new Promise((resolve) => {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
        if (sess) { subscription.unsubscribe(); resolve(sess) }
      })
      setTimeout(() => { subscription.unsubscribe(); resolve(null) }, 3000)
    })
  }
  if (!session) {
    return { ok: false, error: 'ログインセッションが見つかりません。ダッシュボードに再ログインしてからもう一度お試しください。' }
  }

  // Force a fresh access_token before calling the Edge Function.
  // The OAuth consent flow can take long enough for the cached JWT to
  // expire; refreshing eliminates that race deterministically.
  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
  const accessToken = refreshed?.session?.access_token
  if (refreshError || !accessToken) {
    return { ok: false, error: 'セッションの更新に失敗しました。再ログインしてください。' }
  }

  const redirectUri = window.location.origin + '/auth/google/callback'
  const res = await fetch(`${PROXY_BASE}/auth/callback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      code,
      redirect_uri: redirectUri,
      calendar_ids: GCAL_CALENDARS.map((c) => c.id),
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    try { return { ok: false, error: JSON.parse(text).error || text } } catch { return { ok: false, error: text || `HTTP ${res.status}` } }
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
  description?: string | null
}

export interface FailedCalendar {
  calendarId: string
  error: string
}

export interface FetchCalendarEventsResult {
  events: CalendarEvent[]
  failedCalendars: FailedCalendar[]
  partial: boolean
}

/** Fetch events from Google Calendar via Edge Function proxy */
export async function fetchCalendarEvents(options: FetchEventsOptions): Promise<FetchCalendarEventsResult> {
  const calIds = options.calendarIds || GCAL_CALENDARS.map((c) => c.id)
  const params = new URLSearchParams({
    calendar_ids: calIds.join(','),
    time_min: options.timeMin,
    time_max: options.timeMax,
    // Default aligned with Edge Function (Google Calendar API max = 250).
    // The server paginates beyond this, but sending 250 per page minimizes
    // round-trips for typical week/month views.
    max_results: String(options.maxResults || 250),
  })

  const res = await authedFetch(`${PROXY_BASE}/events?${params}`)

  if (res.status === 401) {
    const data = await res.json().catch(() => ({}))
    if (data.error === 'NEEDS_AUTH') {
      throw new Error('NEEDS_AUTH')
    }
  }

  if (!res.ok) throw new Error(`Calendar API error: ${res.status}`)

  const data: {
    events: ProxyEvent[]
    failed_calendars?: FailedCalendar[]
    partial?: boolean
  } = await res.json()

  // Map calendar_id to calendar_type
  const calMap = new Map(GCAL_CALENDARS.map((c) => [c.id, c.type]))

  const events: CalendarEvent[] = data.events.map((ev) => ({
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
    description: ev.description,
  }))

  return {
    events,
    failedCalendars: data.failed_calendars || [],
    partial: data.partial === true,
  }
}

/** Create a new calendar event */
export async function createCalendarEvent(
  calendarId: string,
  event: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await authedFetch(`${PROXY_BASE}/events`, {
    method: 'POST',
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
  const res = await authedFetch(`${PROXY_BASE}/events`, {
    method: 'PATCH',
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
  const res = await authedFetch(`${PROXY_BASE}/events`, {
    method: 'DELETE',
    body: JSON.stringify({ calendar_id: calendarId, event_id: eventId }),
  })
  if (!res.ok) throw new Error(`Delete event failed: ${res.status}`)
}
