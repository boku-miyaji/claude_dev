import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { Card, Modal, toast } from '@/components/ui'
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar'
import { startCalendarAuth } from '@/lib/calendarApi'
import { GCAL_CALENDARS } from '@/lib/constants'
import type { ViewMode, CalendarEvent, CalendarType } from '@/types/calendar'

const DOW = ['日', '月', '火', '水', '木', '金', '土']
const VIEW_LABELS: Record<ViewMode, string> = { day: '日', week: '週', month: '月' }
const HOUR_H = 48
const START_H = 8
const END_H = 22
const SNAP_MIN = 15
const SNAP_PX = HOUR_H * SNAP_MIN / 60
const HOURS = Array.from({ length: END_H - START_H + 1 }, (_, i) => i + START_H)

function toJSTDateStr(d: Date): string {
  return new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tokyo' })
}
function getJSTHours(iso: string): number {
  const d = new Date(iso)
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return jst.getUTCHours() + jst.getUTCMinutes() / 60
}
function dateLabel(date: Date, mode: ViewMode): string {
  const y = date.getFullYear(), m = date.getMonth() + 1
  if (mode === 'day') return `${y}年${m}月${date.getDate()}日`
  if (mode === 'week') { const end = new Date(date); end.setDate(end.getDate() + 6); return `${y}年${m}月${date.getDate()}日 — ${end.getMonth() + 1}月${end.getDate()}日` }
  return `${y}年${m}月`
}
function snapY(y: number): number { return Math.round(y / SNAP_PX) * SNAP_PX }
function yToHours(y: number): number { return START_H + y / HOUR_H }
function buildJSTDateTime(dateStr: string, hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return `${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+09:00`
}

// ============================================================
// Event Modal
// ============================================================

function EventModal({ open, onClose, initialDate, initialHour, editEvent, onSave, onDelete }: {
  open: boolean; onClose: () => void; initialDate?: string; initialHour?: number
  editEvent?: CalendarEvent | null
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
      if (editEvent) {
        setStartTime(fmtTime(editEvent.start_time))
        setEndTime(fmtTime(editEvent.end_time))
      } else {
        const h = initialHour ?? 10
        setStartTime(`${String(h).padStart(2, '0')}:00`)
        setEndTime(`${String(h + 1).padStart(2, '0')}:00`)
      }
    }
  }, [open, editEvent, initialDate, initialHour])

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
// Drag state type
// ============================================================

interface DragState {
  ev: CalendarEvent
  mode: 'move' | 'resize'
  startY: number
  startX: number
  origTop: number
  origHeight: number
  origDayIndex: number
  currentTop: number
  currentHeight: number
  currentDayIndex: number
  durationH: number
}

// ============================================================
// Time Grid (Day / Week view)
// ============================================================

function TimeGrid({ events, days, today, hiddenCalendars, onCellClick, onEventClick, onDragUpdate }: {
  events: CalendarEvent[]; days: Date[]; today: string; hiddenCalendars: Set<CalendarType>
  onCellClick: (date: string, hour: number) => void
  onEventClick: (evt: CalendarEvent) => void
  onDragUpdate: (ev: CalendarEvent, newStartH: number, newEndH: number, newDayIndex: number) => Promise<void>
}) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const [, setDragRender] = useState(0) // force re-render during drag
  const now = useMemo(() => new Date(), [])
  const nowH = now.getHours() + now.getMinutes() / 60
  const todayDayIndex = days.findIndex(d => toJSTDateStr(d) === today)

  const filteredEvents = useMemo(
    () => events.filter(e => !hiddenCalendars.has(e.calendar_type)),
    [events, hiddenCalendars]
  )

  // Group events by day
  const eventsByDay = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>()
    for (let i = 0; i < days.length; i++) map.set(i, [])
    filteredEvents.forEach(evt => {
      const ds = toJSTDateStr(new Date(evt.start_time))
      const di = days.findIndex(d => toJSTDateStr(d) === ds)
      if (di >= 0) map.get(di)!.push(evt)
    })
    return map
  }, [filteredEvents, days])

  // Compute column geometry from CSS grid
  const getColumnGeometry = useCallback(() => {
    if (!bodyRef.current) return null
    const body = bodyRef.current
    const cells = body.querySelectorAll<HTMLElement>('[data-hour="' + START_H + '"]')
    if (cells.length === 0) return null
    const bodyRect = body.getBoundingClientRect()
    const cols: { left: number; width: number }[] = []
    cells.forEach(cell => {
      const r = cell.getBoundingClientRect()
      cols.push({ left: r.left - bodyRect.left, width: r.width })
    })
    return { bodyRect, cols }
  }, [])

  const getDayAtX = useCallback((clientX: number) => {
    const geo = getColumnGeometry()
    if (!geo) return -1
    for (let i = 0; i < geo.cols.length; i++) {
      const absLeft = geo.cols[i].left + geo.bodyRect.left
      if (clientX >= absLeft && clientX < absLeft + geo.cols[i].width) return i
    }
    return -1
  }, [getColumnGeometry])

  // Drag handlers
  const onMouseDown = useCallback((evt: CalendarEvent, mode: 'move' | 'resize', e: React.MouseEvent) => {
    if (evt.all_day) return
    e.preventDefault()
    e.stopPropagation()

    const sH = getJSTHours(evt.start_time)
    const eH = getJSTHours(evt.end_time)
    const origTop = (sH - START_H) * HOUR_H
    const origHeight = Math.max((eH - sH) * HOUR_H, 22)
    const ds = toJSTDateStr(new Date(evt.start_time))
    const origDi = days.findIndex(d => toJSTDateStr(d) === ds)

    dragRef.current = {
      ev: evt, mode, startY: e.clientY, startX: e.clientX,
      origTop, origHeight, origDayIndex: origDi,
      currentTop: origTop, currentHeight: origHeight, currentDayIndex: origDi,
      durationH: eH - sH,
    }
    setDragRender(r => r + 1)

    const onMove = (me: MouseEvent) => {
      const ds = dragRef.current
      if (!ds) return
      const dy = me.clientY - ds.startY

      if (ds.mode === 'move') {
        const newTop = Math.max(0, Math.min(snapY(ds.origTop + dy), (END_H - START_H) * HOUR_H - ds.origHeight))
        const newDi = getDayAtX(me.clientX)
        ds.currentTop = newTop
        if (newDi >= 0) ds.currentDayIndex = newDi
      } else {
        const newHeight = Math.max(SNAP_PX, Math.min(snapY(ds.origHeight + dy), (END_H - START_H) * HOUR_H - ds.origTop))
        ds.currentHeight = newHeight
      }
      setDragRender(r => r + 1)
    }

    const onUp = async () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      const ds = dragRef.current
      if (!ds) return
      dragRef.current = null

      const changed = ds.mode === 'move'
        ? (ds.currentTop !== ds.origTop || ds.currentDayIndex !== ds.origDayIndex)
        : (ds.currentHeight !== ds.origHeight)

      if (changed && ds.currentDayIndex >= 0) {
        const newStartH = ds.mode === 'move' ? yToHours(ds.currentTop) : yToHours(ds.origTop)
        const newEndH = ds.mode === 'move' ? yToHours(ds.currentTop) + ds.durationH : yToHours(ds.origTop + ds.currentHeight)
        await onDragUpdate(ds.ev, newStartH, newEndH, ds.currentDayIndex)
      }
      setDragRender(r => r + 1)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [days, getDayAtX, onDragUpdate])

  // Click-vs-drag distinguisher
  const onEventMouseDown = useCallback((evt: CalendarEvent, e: React.MouseEvent) => {
    if (evt.all_day) { onEventClick(evt); return }
    const sx = e.clientX, sy = e.clientY
    let moved = false
    let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => { moved = true; onMouseDown(evt, 'move', e) }, 150)

    const checkMove = (me: MouseEvent) => {
      if (Math.abs(me.clientX - sx) > 4 || Math.abs(me.clientY - sy) > 4) {
        if (!moved && timer) { clearTimeout(timer); moved = true; onMouseDown(evt, 'move', e) }
        document.removeEventListener('mousemove', checkMove)
      }
    }
    const onUp = () => {
      document.removeEventListener('mousemove', checkMove)
      document.removeEventListener('mouseup', onUp)
      if (!moved) { if (timer) clearTimeout(timer); onEventClick(evt) }
    }
    document.addEventListener('mousemove', checkMove)
    document.addEventListener('mouseup', onUp)
  }, [onEventClick, onMouseDown])

  const drag = dragRef.current

  return (
    <div>
      {/* Day headers */}
      <div className="cal-tg-hdr" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
        <div className="cal-tg-corner" />
        {days.map(d => {
          const ds = toJSTDateStr(d), isToday = ds === today
          return (
            <div key={ds} className={'cal-tg-day-hdr' + (isToday ? ' cal-today' : '')}>
              <span className="cal-tg-dow">{DOW[d.getDay()]}</span>
              <span className="cal-tg-date">{d.getDate()}</span>
            </div>
          )
        })}
      </div>

      {/* Time grid body */}
      <div ref={bodyRef} className="cal-tg-body" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
        {/* Grid cells */}
        {HOURS.map(h => (
          <React.Fragment key={h}>
            <div className="cal-tg-time">{h > START_H ? `${String(h).padStart(2, '0')}:00` : ''}</div>
            {days.map((d, di) => (
              <div key={di} className="cal-tg-cell" data-day={di} data-hour={h} style={{ position: 'relative' }}
                onClick={() => { if (!dragRef.current) onCellClick(toJSTDateStr(d), h) }} />
            ))}
          </React.Fragment>
        ))}

        {/* Events (absolutely positioned) */}
        {days.map((_d, di) => {
          const dayEvts = eventsByDay.get(di) || []
          const colStyle = {
            position: 'absolute' as const,
            top: 0,
            left: `calc(56px + ${di} * (100% - 56px) / ${days.length} + 2px)`,
            width: `calc((100% - 56px) / ${days.length} - 4px)`,
            height: '100%',
            pointerEvents: 'none' as const,
          }
          return (
            <div key={di} style={colStyle}>
              {dayEvts.map(evt => {
                const isDragging = drag?.ev.id === evt.id
                let sH = getJSTHours(evt.start_time)
                let eH = getJSTHours(evt.end_time)
                if (evt.all_day) { sH = START_H; eH = START_H + 0.5 }

                let top = (sH - START_H) * HOUR_H
                let height = Math.max((eH - sH) * HOUR_H, 22)

                // If this event is being dragged, use drag state
                if (isDragging) {
                  if (drag.mode === 'move') {
                    top = drag.currentTop
                    // If moved to a different day, hide from this column
                    if (drag.currentDayIndex !== di) return null
                  } else {
                    height = drag.currentHeight
                  }
                }

                const isPast = toJSTDateStr(new Date(evt.start_time)) === today && new Date(evt.end_time) < now

                return (
                  <div key={evt.id}
                    className={`cal-tg-ev cal-${evt.calendar_type}${isPast ? ' cal-past' : ''}${isDragging ? ' dragging' : ''}`}
                    style={{ top, height: height - 2, cursor: evt.all_day ? 'default' : 'grab', pointerEvents: 'auto' }}
                    onMouseDown={e => { if (!e.defaultPrevented) onEventMouseDown(evt, e) }}>
                    <span className="cal-tg-ev-time" />
                    <span className="cal-tg-ev-title">{evt.summary}</span>
                    {!evt.all_day && (
                      <div className="cal-tg-resize"
                        onMouseDown={e => { e.stopPropagation(); onMouseDown(evt, 'resize', e) }} />
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}

        {/* Ghost (original position while dragging) */}
        {drag && (
          <div className={`cal-tg-ghost cal-${drag.ev.calendar_type}`}
            style={{
              position: 'absolute',
              top: drag.origTop,
              left: `calc(56px + ${drag.origDayIndex} * (100% - 56px) / ${days.length} + 2px)`,
              width: `calc((100% - 56px) / ${days.length} - 4px)`,
              height: drag.origHeight - 2,
            }} />
        )}

        {/* Now indicator */}
        {todayDayIndex >= 0 && nowH >= START_H && nowH <= END_H && (
          <div className="cal-tg-now" style={{
            top: (nowH - START_H) * HOUR_H,
            left: `calc(56px + ${todayDayIndex} * (100% - 56px) / ${days.length})`,
            width: `calc((100% - 56px) / ${days.length})`,
          }} />
        )}
      </div>
    </div>
  )
}

// We need React import for JSX.Fragment
import React from 'react'

// ============================================================
// Month Grid
// ============================================================

function MonthGrid({ events, date, today, hiddenCalendars, onCellClick, onEventClick }: {
  events: CalendarEvent[]; date: Date; today: string; hiddenCalendars: Set<CalendarType>
  onCellClick: (date: string) => void; onEventClick: (evt: CalendarEvent) => void
}) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  const cells: (Date | null)[] = []
  for (let i = 0; i < firstDay.getDay(); i++) cells.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(date.getFullYear(), date.getMonth(), d))
  while (cells.length % 7 !== 0) cells.push(null)

  const filtered = useMemo(
    () => events.filter(e => !hiddenCalendars.has(e.calendar_type)),
    [events, hiddenCalendars]
  )
  const eventsFor = (ds: string) => filtered.filter(e => toJSTDateStr(new Date(e.start_time)) === ds)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', marginBottom: 4 }}>
        {DOW.map((d, i) => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: i === 0 ? '#ef4444' : i === 6 ? '#3b82f6' : 'var(--text3)', padding: 4 }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px' }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} style={{ minHeight: 90, background: 'var(--surface2)', borderRadius: 4, opacity: 0.3 }} />
          const ds = toJSTDateStr(d), isToday = ds === today, dayEvts = eventsFor(ds)
          return (
            <div key={i} className="cal-day" style={{ minHeight: 90, padding: 8, background: isToday ? 'var(--accent-bg)' : undefined, cursor: 'pointer', borderRadius: 4 }}
              onClick={() => onCellClick(ds)}>
              <div className="cal-day-hdr" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--accent)' : 'var(--text2)' }}>{d.getDate()}</span>
              </div>
              {dayEvts.slice(0, 3).map(evt => (
                <div key={evt.id} className={`cal-evt cal-${evt.calendar_type}`}
                  style={{ fontSize: 10, padding: '2px 5px', marginBottom: 2, borderRadius: 3, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', cursor: 'pointer' }}
                  onClick={e => { e.stopPropagation(); onEventClick(evt) }}>
                  <span className="cal-evt-title" style={{ fontSize: 10 }}>{evt.summary.substring(0, 15)}</span>
                </div>
              ))}
              {dayEvts.length > 3 && <div style={{ fontSize: 9, color: 'var(--text3)' }}>+{dayEvts.length - 3}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================
// Calendar Legend + Filter
// ============================================================

function CalendarLegend({ hiddenCalendars, onToggle }: {
  hiddenCalendars: Set<CalendarType>; onToggle: (type: CalendarType) => void
}) {
  return (
    <div className="cal-legend" style={{ marginTop: 8 }}>
      {GCAL_CALENDARS.map(c => {
        const hidden = hiddenCalendars.has(c.type)
        const dotClass = c.type === 'primary' ? 'p' : c.type === 'work' ? 'w' : 's'
        return (
          <div key={c.id} className="cal-legend-item" style={{ cursor: 'pointer', opacity: hidden ? 0.35 : 1 }}
            onClick={() => onToggle(c.type)}>
            <div className={`cal-legend-dot ${dotClass}`} />
            {c.label}
          </div>
        )
      })}
    </div>
  )
}

// ============================================================
// Main
// ============================================================

export function Calendar() {
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [viewDate, setViewDate] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()) })
  const [modalOpen, setModalOpen] = useState(false)
  const [modalDate, setModalDate] = useState('')
  const [modalHour, setModalHour] = useState<number | undefined>(undefined)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [hiddenCalendars, setHiddenCalendars] = useState<Set<CalendarType>>(new Set())

  const { events, loading, authenticated, refetch, createEvent, updateEvent, deleteEvent } = useGoogleCalendar(viewDate, viewMode)
  const today = toJSTDateStr(new Date())

  const nav = useCallback((dir: number) => {
    setViewDate(prev => {
      const d = new Date(prev)
      if (viewMode === 'day') d.setDate(d.getDate() + dir)
      else if (viewMode === 'week') d.setDate(d.getDate() + 7 * dir)
      else { d.setMonth(d.getMonth() + dir); d.setDate(1) }
      return d
    })
  }, [viewMode])

  const days = useMemo(() => {
    if (viewMode === 'day') return [new Date(viewDate)]
    if (viewMode === 'week') return Array.from({ length: 7 }, (_, i) => { const d = new Date(viewDate); d.setDate(d.getDate() + i); return d })
    return []
  }, [viewDate, viewMode])

  const handleSave = async (form: { summary: string; date: string; startTime: string; endTime: string }) => {
    const start = { dateTime: `${form.date}T${form.startTime}:00+09:00`, timeZone: 'Asia/Tokyo' }
    const end = { dateTime: `${form.date}T${form.endTime}:00+09:00`, timeZone: 'Asia/Tokyo' }
    try {
      if (editingEvent) {
        await updateEvent(editingEvent.calendar_id, editingEvent.id, { summary: form.summary, start, end })
        toast('更新しました')
      } else {
        await createEvent('primary', { summary: form.summary, start, end })
        toast('追加しました')
      }
      refetch()
    } catch { toast('保存に失敗しました') }
  }

  const handleDelete = async () => {
    if (!editingEvent) return
    try {
      await deleteEvent(editingEvent.calendar_id, editingEvent.id)
      toast('削除しました')
      refetch()
    } catch { toast('削除に失敗しました') }
  }

  const handleDragUpdate = useCallback(async (ev: CalendarEvent, newStartH: number, newEndH: number, newDayIndex: number) => {
    const dateStr = toJSTDateStr(days[newDayIndex])
    const newStart = buildJSTDateTime(dateStr, newStartH)
    const newEnd = buildJSTDateTime(dateStr, newEndH)
    try {
      await updateEvent(ev.calendar_id, ev.id, {
        start: { dateTime: newStart, timeZone: 'Asia/Tokyo' },
        end: { dateTime: newEnd, timeZone: 'Asia/Tokyo' },
      })
      toast('移動しました')
      refetch()
    } catch { toast('更新に失敗しました') }
  }, [days, updateEvent, refetch])

  const toggleCalendar = useCallback((type: CalendarType) => {
    setHiddenCalendars(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type); else next.add(type)
      return next
    })
  }, [])

  // Loading auth
  if (authenticated === null) {
    return <div className="page"><div className="skeleton-card" style={{ height: 300 }} /></div>
  }

  // Not authenticated
  if (authenticated === false) {
    return (
      <div className="page">
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>📅</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Google Calendar と連携</div>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>認証後、同じタブでカレンダーが表示されます</p>
          <button className="btn btn-primary" style={{ fontSize: 14, padding: '12px 32px' }} onClick={startCalendarAuth}>
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
        <button className="btn btn-ghost btn-sm" onClick={refetch} style={{ fontSize: 11 }}>↻</button>
      </div>

      {loading && <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Loading...</div>}

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {viewMode === 'month'
          ? <MonthGrid events={events} date={viewDate} today={today} hiddenCalendars={hiddenCalendars}
              onCellClick={ds => { setModalDate(ds); setModalHour(undefined); setEditingEvent(null); setModalOpen(true) }}
              onEventClick={evt => { setEditingEvent(evt); setModalOpen(true) }} />
          : <TimeGrid events={events} days={days} today={today} hiddenCalendars={hiddenCalendars}
              onCellClick={(ds, hour) => { setModalDate(ds); setModalHour(hour); setEditingEvent(null); setModalOpen(true) }}
              onEventClick={evt => { setEditingEvent(evt); setModalOpen(true) }}
              onDragUpdate={handleDragUpdate} />
        }
      </Card>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>{events.length} events</div>
        <CalendarLegend hiddenCalendars={hiddenCalendars} onToggle={toggleCalendar} />
      </div>

      <EventModal open={modalOpen} onClose={() => setModalOpen(false)} initialDate={modalDate} initialHour={modalHour}
        editEvent={editingEvent} onSave={handleSave} onDelete={editingEvent ? handleDelete : undefined} />
    </div>
  )
}
