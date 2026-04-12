import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { Card, PageHeader, Modal, toast } from '@/components/ui'
import { GCAL_CLIENT_ID, GCAL_SCOPES, GCAL_CALENDARS } from '@/lib/constants'
import type { ViewMode, CalendarType } from '@/types/calendar'

// ============================================================
// Types & Constants
// ============================================================

interface CalEvent {
  id: string; calendar_id: string; calendar_type: CalendarType
  summary: string; start_time: string; end_time: string; all_day: boolean
}

const DOW = ['日', '月', '火', '水', '木', '金', '土']
const VIEW_LABELS: Record<ViewMode, string> = { day: '日', week: '週', month: '月' }
const CAL_COLORS: Record<string, string> = { primary: 'var(--accent)', secondary: 'var(--accent2)', work: 'var(--blue)' }
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7)

declare const google: { accounts: { oauth2: { initTokenClient: (config: Record<string, unknown>) => { requestAccessToken: () => void } } } }

function toJSTDateStr(d: Date): string {
  return new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tokyo' })
}

function dateLabel(date: Date, mode: ViewMode): string {
  const y = date.getFullYear(), m = date.getMonth() + 1
  if (mode === 'day') return `${y}年${m}月${date.getDate()}日`
  if (mode === 'week') { const end = new Date(date); end.setDate(end.getDate() + 6); return `${y}年${m}月${date.getDate()}日 — ${end.getMonth() + 1}月${end.getDate()}日` }
  return `${y}年${m}月`
}

// ============================================================
// GIS Auth + Google Calendar API (legacy approach)
// ============================================================

function getStoredToken(): string | null {
  const token = localStorage.getItem('gcal_token')
  const time = parseInt(localStorage.getItem('gcal_token_time') || '0')
  if (token && Date.now() - time < 3500_000) return token // ~58 min expiry
  return null
}

function requestToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof google === 'undefined' || !google.accounts) {
      reject(new Error('Google Identity Services not loaded'))
      return
    }
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GCAL_CLIENT_ID,
      scope: GCAL_SCOPES,
      prompt: '',
      callback: (resp: { error?: string; access_token?: string }) => {
        if (resp.error || !resp.access_token) { reject(new Error(resp.error || 'No token')); return }
        localStorage.setItem('gcal_token', resp.access_token)
        localStorage.setItem('gcal_token_time', String(Date.now()))
        resolve(resp.access_token)
      },
    })
    client.requestAccessToken()
  })
}

async function fetchEvents(token: string, timeMin: Date, timeMax: Date): Promise<CalEvent[]> {
  const calMap = new Map(GCAL_CALENDARS.map(c => [c.id, c.type]))
  const results: CalEvent[] = []

  for (const cal of GCAL_CALENDARS) {
    try {
      const params = new URLSearchParams({
        timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(),
        singleEvents: 'true', orderBy: 'startTime', maxResults: '100',
      })
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) continue
      const data = await res.json()
      for (const item of data.items || []) {
        results.push({
          id: item.id,
          calendar_id: cal.id,
          calendar_type: calMap.get(cal.id) || 'primary',
          summary: item.summary || '(no title)',
          start_time: item.start?.dateTime || item.start?.date || '',
          end_time: item.end?.dateTime || item.end?.date || '',
          all_day: !item.start?.dateTime,
        })
      }
    } catch { /* skip failed calendar */ }
  }

  return results.sort((a, b) => a.start_time.localeCompare(b.start_time))
}

// ============================================================
// Event Modal
// ============================================================

function EventModal({ open, onClose, initialDate, editEvent, onSave, onDelete }: {
  open: boolean; onClose: () => void; initialDate?: string
  editEvent?: CalEvent | null
  onSave: (form: { summary: string; date: string; startTime: string; endTime: string }) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [summary, setSummary] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('10:00')
  const [endTime, setEndTime] = useState('11:00')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setSummary(editEvent?.summary || '')
      setDate(editEvent ? toJSTDateStr(new Date(editEvent.start_time)) : initialDate || toJSTDateStr(new Date()))
      setStartTime(editEvent ? fmtTime(editEvent.start_time) : '10:00')
      setEndTime(editEvent ? fmtTime(editEvent.end_time) : '11:00')
    }
  }, [open, editEvent, initialDate])

  return (
    <Modal open={open} onClose={onClose} title={editEvent ? 'イベントを編集' : 'イベントを追加'}
      footer={<div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" disabled={saving || !summary.trim()} onClick={async () => {
          setSaving(true); await onSave({ summary, date, startTime, endTime }); setSaving(false); onClose()
        }}>{saving ? '保存中...' : '保存'}</button>
        <button className="btn btn-ghost" onClick={onClose}>キャンセル</button>
        {editEvent && onDelete && <button className="btn" style={{ color: 'var(--red)', marginLeft: 'auto' }} disabled={saving} onClick={async () => {
          if (!confirm('削除しますか？')) return; setSaving(true); await onDelete(); setSaving(false); onClose()
        }}>削除</button>}
      </div>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>タイトル</label>
          <input className="input" value={summary} onChange={e => setSummary(e.target.value)} placeholder="イベント名" autoFocus /></div>
        <div><label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>日付</label>
          <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}><label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>開始</label>
            <input className="input" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} /></div>
          <div style={{ flex: 1 }}><label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>終了</label>
            <input className="input" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} /></div>
        </div>
      </div>
    </Modal>
  )
}

// ============================================================
// Time Grid
// ============================================================

function TimeGrid({ events, days, today, onCellClick, onEventClick }: {
  events: CalEvent[]; days: Date[]; today: string
  onCellClick: (date: string) => void; onEventClick: (evt: CalEvent) => void
}) {
  const eventsFor = (ds: string) => events.filter(e => toJSTDateStr(new Date(e.start_time)) === ds)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: `56px repeat(${days.length}, 1fr)`, borderBottom: '1px solid var(--border)' }}>
        <div />
        {days.map(d => {
          const ds = toJSTDateStr(d), isToday = ds === today
          return <div key={ds} style={{ textAlign: 'center', padding: '8px 0', borderLeft: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--text3)' }}>{DOW[d.getDay()]}</div>
            <div style={{ fontSize: 18, fontWeight: 700, ...(isToday ? { color: '#fff', background: 'var(--accent)', borderRadius: '50%', width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } : {}) }}>{d.getDate()}</div>
          </div>
        })}
      </div>
      <div style={{ position: 'relative' }}>
        {HOURS.map(h => (
          <div key={h} style={{ display: 'grid', gridTemplateColumns: `56px repeat(${days.length}, 1fr)`, minHeight: 48 }}>
            <div style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'right', paddingRight: 8, paddingTop: 2, fontFamily: 'var(--mono)' }}>
              {h > 7 ? `${String(h).padStart(2, '0')}:00` : ''}
            </div>
            {days.map((d, di) => (
              <div key={di} style={{ borderLeft: '1px solid var(--border)', borderBottom: '1px solid var(--border)', minHeight: 48, position: 'relative', padding: 2, cursor: 'pointer' }}
                onClick={() => onCellClick(toJSTDateStr(d))}>
                {h === HOURS[0] && eventsFor(toJSTDateStr(d)).map(evt => {
                  const sH = new Date(evt.start_time).getHours() + new Date(evt.start_time).getMinutes() / 60
                  const eH = new Date(evt.end_time).getHours() + new Date(evt.end_time).getMinutes() / 60
                  const top = Math.max(0, (sH - 7) * 48), height = Math.max(20, (eH - sH) * 48)
                  return <div key={evt.id} title={`${fmtTime(evt.start_time)} ${evt.summary}`} style={{
                    position: 'absolute', top, left: 2, right: 2, height, zIndex: 1,
                    background: `${CAL_COLORS[evt.calendar_type] || 'var(--accent)'}20`,
                    borderLeft: `3px solid ${CAL_COLORS[evt.calendar_type] || 'var(--accent)'}`,
                    borderRadius: 4, padding: '2px 6px', overflow: 'hidden', cursor: 'pointer', fontSize: 11,
                  }} onClick={e => { e.stopPropagation(); onEventClick(evt) }}>
                    <div style={{ fontWeight: 600, fontSize: 10, color: 'var(--text3)' }}>{evt.all_day ? '終日' : fmtTime(evt.start_time)}</div>
                    <div style={{ fontWeight: 500, color: 'var(--text)' }}>{evt.summary}</div>
                  </div>
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// Month Grid
// ============================================================

function MonthGrid({ events, date, today, onCellClick, onEventClick }: {
  events: CalEvent[]; date: Date; today: string
  onCellClick: (date: string) => void; onEventClick: (evt: CalEvent) => void
}) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  const cells: (Date | null)[] = []
  for (let i = 0; i < firstDay.getDay(); i++) cells.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(date.getFullYear(), date.getMonth(), d))
  while (cells.length % 7 !== 0) cells.push(null)

  const eventsFor = (ds: string) => events.filter(e => toJSTDateStr(new Date(e.start_time)) === ds)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
        {DOW.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 10, color: 'var(--text3)', padding: '8px 0' }}>{d}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} style={{ minHeight: 80, borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }} />
          const ds = toJSTDateStr(d), isToday = ds === today, dayEvts = eventsFor(ds)
          return <div key={i} style={{ minHeight: 80, padding: 4, borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', background: isToday ? 'var(--accent-bg)' : undefined, cursor: 'pointer' }}
            onClick={() => onCellClick(ds)}>
            <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--accent)' : 'var(--text2)', marginBottom: 4 }}>{d.getDate()}</div>
            {dayEvts.slice(0, 3).map(evt => (
              <div key={evt.id} style={{ fontSize: 10, padding: '1px 4px', marginBottom: 2, borderRadius: 3, background: `${CAL_COLORS[evt.calendar_type] || 'var(--accent)'}15`, color: 'var(--text2)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', cursor: 'pointer' }}
                onClick={e => { e.stopPropagation(); onEventClick(evt) }}>{evt.summary.substring(0, 12)}</div>
            ))}
            {dayEvts.length > 3 && <div style={{ fontSize: 9, color: 'var(--text3)' }}>+{dayEvts.length - 3}</div>}
          </div>
        })}
      </div>
    </div>
  )
}

// ============================================================
// Main
// ============================================================

export function Calendar() {
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [viewDate, setViewDate] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()) })
  const [token, setToken] = useState<string | null>(getStoredToken)
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalDate, setModalDate] = useState('')
  const [editingEvent, setEditingEvent] = useState<CalEvent | null>(null)
  const loadingRef = useRef(false)

  const today = toJSTDateStr(new Date())

  // Compute date range
  const range = useMemo((): [Date, Date] => {
    if (viewMode === 'day') { const e = new Date(viewDate); e.setDate(e.getDate() + 1); return [viewDate, e] }
    if (viewMode === 'week') { const e = new Date(viewDate); e.setDate(e.getDate() + 7); return [viewDate, e] }
    return [new Date(viewDate.getFullYear(), viewDate.getMonth(), 1), new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1)]
  }, [viewDate, viewMode])

  const days = useMemo(() => {
    if (viewMode === 'day') return [new Date(viewDate)]
    if (viewMode === 'week') return Array.from({ length: 7 }, (_, i) => { const d = new Date(viewDate); d.setDate(d.getDate() + i); return d })
    return []
  }, [viewDate, viewMode])

  // Load events
  const loadEvents = useCallback(async (t: string) => {
    if (loadingRef.current) return
    loadingRef.current = true; setLoading(true)
    try {
      const evts = await fetchEvents(t, range[0], range[1])
      setEvents(evts)
    } catch {
      // Token might be expired
      localStorage.removeItem('gcal_token')
      setToken(null)
    }
    setLoading(false); loadingRef.current = false
  }, [range])

  useEffect(() => { if (token) loadEvents(token) }, [token, loadEvents])

  const handleSignIn = async () => {
    try {
      const t = await requestToken()
      setToken(t)
    } catch (e) {
      toast('Google認証に失敗しました')
      console.error(e)
    }
  }

  const nav = (dir: number) => {
    const d = new Date(viewDate)
    if (viewMode === 'day') d.setDate(d.getDate() + dir)
    else if (viewMode === 'week') d.setDate(d.getDate() + 7 * dir)
    else { d.setMonth(d.getMonth() + dir); d.setDate(1) }
    setViewDate(d)
  }

  // CRUD
  const handleSave = async (form: { summary: string; date: string; startTime: string; endTime: string }) => {
    if (!token) return
    const start = `${form.date}T${form.startTime}:00+09:00`
    const end = `${form.date}T${form.endTime}:00+09:00`
    const body = { summary: form.summary, start: { dateTime: start, timeZone: 'Asia/Tokyo' }, end: { dateTime: end, timeZone: 'Asia/Tokyo' } }

    try {
      if (editingEvent) {
        await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(editingEvent.calendar_id)}/events/${editingEvent.id}`, {
          method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        })
        toast('更新しました')
      } else {
        await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        })
        toast('追加しました')
      }
      loadEvents(token)
    } catch { toast('保存に失敗しました') }
  }

  const handleDelete = async () => {
    if (!token || !editingEvent) return
    try {
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(editingEvent.calendar_id)}/events/${editingEvent.id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      })
      toast('削除しました')
      loadEvents(token)
    } catch { toast('削除に失敗しました') }
  }

  // Not authenticated
  if (!token) {
    return (
      <div className="page">
        <PageHeader title="Calendar" />
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>📅</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Google Calendar と連携</div>
          <button className="btn btn-primary" style={{ fontSize: 14, padding: '12px 32px' }} onClick={handleSignIn}>
            Sign in with Google
          </button>
        </Card>
      </div>
    )
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => nav(-1)}>◀</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setViewDate(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()))}>今日</button>
        <button className="btn btn-ghost btn-sm" onClick={() => nav(1)}>▶</button>
        <span style={{ fontSize: 15, fontWeight: 600, minWidth: 160 }}>{dateLabel(viewDate, viewMode)}</span>
        <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
          {(['day', 'week', 'month'] as ViewMode[]).map(v => (
            <button key={v} className="btn btn-sm" onClick={() => setViewMode(v)} style={{
              fontSize: 12, padding: '4px 12px', border: '1px solid var(--border)',
              background: v === viewMode ? 'var(--accent)' : 'transparent',
              color: v === viewMode ? '#fff' : 'var(--text2)', borderRadius: 4,
            }}>{VIEW_LABELS[v]}</button>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => token && loadEvents(token)} style={{ fontSize: 11 }}>↻</button>
      </div>

      {loading && <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Loading...</div>}

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {viewMode === 'month'
          ? <MonthGrid events={events} date={viewDate} today={today}
              onCellClick={ds => { setModalDate(ds); setEditingEvent(null); setModalOpen(true) }}
              onEventClick={evt => { setEditingEvent(evt); setModalOpen(true) }} />
          : <TimeGrid events={events} days={days} today={today}
              onCellClick={ds => { setModalDate(ds); setEditingEvent(null); setModalOpen(true) }}
              onEventClick={evt => { setEditingEvent(evt); setModalOpen(true) }} />
        }
      </Card>

      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>{events.length} events</div>

      <EventModal open={modalOpen} onClose={() => setModalOpen(false)} initialDate={modalDate}
        editEvent={editingEvent} onSave={handleSave} onDelete={editingEvent ? handleDelete : undefined} />
    </div>
  )
}
