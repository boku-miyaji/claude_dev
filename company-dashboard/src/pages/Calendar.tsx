import { useState, useMemo } from 'react'
import { Card, PageHeader } from '@/components/ui'
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar'
import type { ViewMode, CalendarEvent } from '@/types/calendar'

const DOW = ['日', '月', '火', '水', '木', '金', '土']
const VIEW_LABELS: Record<ViewMode, string> = { day: '日', week: '週', month: '月' }
const CAL_COLORS: Record<string, string> = { primary: 'var(--accent)', secondary: 'var(--accent2)', work: 'var(--blue)' }
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7) // 7:00-21:00

function toJSTDate(d: Date): string {
  return new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tokyo' })
}

function navigateDate(date: Date, dir: number, mode: ViewMode): Date {
  const d = new Date(date)
  if (mode === 'day') d.setDate(d.getDate() + dir)
  else if (mode === 'week') d.setDate(d.getDate() + 7 * dir)
  else { d.setMonth(d.getMonth() + dir); d.setDate(1) }
  return d
}

function dateLabel(date: Date, mode: ViewMode): string {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  if (mode === 'day') return `${y}年${m}月${date.getDate()}日`
  if (mode === 'week') {
    const end = new Date(date); end.setDate(end.getDate() + 6)
    return `${y}年${m}月${date.getDate()}日 — ${end.getMonth() + 1}月${end.getDate()}日`
  }
  return `${y}年${m}月`
}

// ============================================================
// Time Grid (Day/Week view)
// ============================================================

function TimeGrid({ events, days, today }: { events: CalendarEvent[]; days: Date[]; today: string }) {
  const eventsForDay = (dateStr: string) => events.filter((e) => toJSTDate(new Date(e.start_time)) === dateStr)

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: `56px repeat(${days.length}, 1fr)`, borderBottom: '1px solid var(--border)' }}>
        <div />
        {days.map((d) => {
          const ds = toJSTDate(d)
          const isToday = ds === today
          return (
            <div key={ds} style={{ textAlign: 'center', padding: '8px 0', borderLeft: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>{DOW[d.getDay()]}</div>
              <div style={{
                fontSize: 18, fontWeight: 700,
                ...(isToday ? { color: '#fff', background: 'var(--accent)', borderRadius: '50%', width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } : {}),
              }}>{d.getDate()}</div>
            </div>
          )
        })}
      </div>

      {/* Grid body */}
      <div style={{ position: 'relative' }}>
        {HOURS.map((h) => (
          <div key={h} style={{ display: 'grid', gridTemplateColumns: `56px repeat(${days.length}, 1fr)`, minHeight: 48 }}>
            <div style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'right', paddingRight: 8, paddingTop: 2, fontFamily: 'var(--mono)' }}>
              {h > 7 ? `${String(h).padStart(2, '0')}:00` : ''}
            </div>
            {days.map((d, di) => (
              <div key={di} style={{ borderLeft: '1px solid var(--border)', borderBottom: '1px solid var(--border)', minHeight: 48, position: 'relative', padding: 2 }}>
                {h === HOURS[0] && eventsForDay(toJSTDate(d)).map((evt) => {
                  const startH = new Date(evt.start_time).getHours() + new Date(evt.start_time).getMinutes() / 60
                  const endH = new Date(evt.end_time).getHours() + new Date(evt.end_time).getMinutes() / 60
                  const top = Math.max(0, (startH - 7) * 48)
                  const height = Math.max(20, (endH - startH) * 48)
                  return (
                    <div key={evt.id} title={`${formatTime(evt.start_time)} ${evt.summary}`} style={{
                      position: 'absolute', top, left: 2, right: 2, height, zIndex: 1,
                      background: `${CAL_COLORS[evt.calendar_type] || 'var(--accent)'}20`,
                      borderLeft: `3px solid ${CAL_COLORS[evt.calendar_type] || 'var(--accent)'}`,
                      borderRadius: 4, padding: '2px 6px', overflow: 'hidden', cursor: 'default',
                      fontSize: 11, lineHeight: '1.3',
                    }}>
                      <div style={{ fontWeight: 600, fontSize: 10, color: 'var(--text3)' }}>{evt.all_day ? '終日' : formatTime(evt.start_time)}</div>
                      <div style={{ fontWeight: 500, color: 'var(--text)' }}>{evt.summary}</div>
                    </div>
                  )
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

function MonthGrid({ events, date, today }: { events: CalendarEvent[]; date: Date; today: string }) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  const startDow = firstDay.getDay()

  const cells: (Date | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(date.getFullYear(), date.getMonth(), d))
  while (cells.length % 7 !== 0) cells.push(null)

  const eventsForDay = (dateStr: string) => events.filter((e) => toJSTDate(new Date(e.start_time)) === dateStr)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
        {DOW.map((d) => <div key={d} style={{ textAlign: 'center', fontSize: 10, color: 'var(--text3)', padding: '8px 0' }}>{d}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} style={{ minHeight: 80, borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }} />
          const ds = toJSTDate(d)
          const isToday = ds === today
          const dayEvents = eventsForDay(ds)
          return (
            <div key={i} style={{ minHeight: 80, padding: 4, borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', background: isToday ? 'var(--accent-bg)' : undefined }}>
              <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--accent)' : 'var(--text2)', marginBottom: 4 }}>{d.getDate()}</div>
              {dayEvents.slice(0, 3).map((evt) => (
                <div key={evt.id} style={{ fontSize: 10, padding: '1px 4px', marginBottom: 2, borderRadius: 3, background: `${CAL_COLORS[evt.calendar_type] || 'var(--accent)'}15`, color: 'var(--text2)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {evt.summary.substring(0, 12)}
                </div>
              ))}
              {dayEvents.length > 3 && <div style={{ fontSize: 9, color: 'var(--text3)' }}>+{dayEvents.length - 3}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================
// Main Page
// ============================================================

export function Calendar() {
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  })

  const { events, loading, error, token, requestAuth, refetch } = useGoogleCalendar(viewDate, viewMode)
  const today = toJSTDate(new Date())

  const days = useMemo(() => {
    if (viewMode === 'day') return [new Date(viewDate)]
    if (viewMode === 'week') return Array.from({ length: 7 }, (_, i) => { const d = new Date(viewDate); d.setDate(d.getDate() + i); return d })
    return [] // month uses its own grid
  }, [viewDate, viewMode])

  // Not authenticated
  if (token === null) {
    return (
      <div className="page">
        <PageHeader title="Calendar" />
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>📅</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Google Calendar と連携</div>
          <button className="btn btn-primary" style={{ fontSize: 14, padding: '12px 32px' }} onClick={requestAuth}>
            Sign in with Google
          </button>
        </Card>
      </div>
    )
  }

  return (
    <div className="page">
      {/* Navigation bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setViewDate(navigateDate(viewDate, -1, viewMode))}>◀</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setViewDate(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()))}>今日</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setViewDate(navigateDate(viewDate, 1, viewMode))}>▶</button>
        <span style={{ fontSize: 15, fontWeight: 600, minWidth: 160 }}>{dateLabel(viewDate, viewMode)}</span>

        <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
          {(['day', 'week', 'month'] as ViewMode[]).map((v) => (
            <button key={v} className="btn btn-sm" onClick={() => setViewMode(v)} style={{
              fontSize: 12, padding: '4px 12px', border: '1px solid var(--border)',
              background: v === viewMode ? 'var(--accent)' : 'transparent',
              color: v === viewMode ? '#fff' : 'var(--text2)', borderRadius: 4,
            }}>{VIEW_LABELS[v]}</button>
          ))}
        </div>

        <button className="btn btn-ghost btn-sm" onClick={refetch} style={{ fontSize: 11 }}>↻</button>
      </div>

      {/* Status */}
      {error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 8 }}>{error}</div>}
      {loading && <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Loading...</div>}

      {/* Calendar view */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {viewMode === 'month'
          ? <MonthGrid events={events} date={viewDate} today={today} />
          : <TimeGrid events={events} days={days} today={today} />
        }
      </Card>

      {/* Event count */}
      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
        {events.length} events
      </div>
    </div>
  )
}
