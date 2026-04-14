import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { Card, Modal, toast } from '@/components/ui'
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar'
import { startCalendarAuth } from '@/lib/calendarApi'
import { GCAL_CALENDARS } from '@/lib/constants'
import type { ViewMode, CalendarEvent, CalendarType } from '@/types/calendar'
import type { Task } from '@/types/tasks'
import { useCalendarLayers, moodLevel, moodBgColor, moodEmoji, type CalendarLayerMap } from '@/hooks/useCalendarLayers'
import { DayDetailDrawer } from '@/components/DayDetailDrawer'
import { useDataStore } from '@/stores/data'

/* ── Calendar layer toggles ── */

type LayerKey = 'mood' | 'habits' | 'diary' | 'events' | 'tasks'

const DEFAULT_LAYERS: Record<LayerKey, boolean> = {
  mood: true,
  habits: true,
  diary: true,
  events: true,
  tasks: false,
}

const LAYER_META: { key: LayerKey; label: string; swatch: string }[] = [
  { key: 'mood', label: '気分', swatch: '#84cc16' },
  { key: 'habits', label: 'ハビッツ', swatch: '#16a34a' },
  { key: 'diary', label: '日記', swatch: '#3b82f6' },
  { key: 'events', label: '予定', swatch: '#1a7f37' },
  { key: 'tasks', label: 'タスク', swatch: '#8b5cf6' },
]

function loadLayers(): Record<LayerKey, boolean> {
  try {
    const raw = localStorage.getItem('calendar-layers')
    if (!raw) return { ...DEFAULT_LAYERS }
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_LAYERS, ...parsed }
  } catch { return { ...DEFAULT_LAYERS } }
}

// ============================================================
// Task types — canonical Task is imported from @/types/tasks
// ============================================================

const TASK_COLOR = '#8b5cf6'

const DOW = ['日', '月', '火', '水', '木', '金', '土']
const VIEW_LABELS: Record<ViewMode, string> = { day: '日', week: '週', month: '月' }
const CAL_BG_COLORS: Record<CalendarType, string> = {
  primary: '#5b5fc7',
  secondary: '#b45309',
  work: '#1a7f37',
}
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
function hoursToTimeStr(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
function timeStrToMinutes(s: string): number {
  const [h, m] = s.split(':').map(n => parseInt(n, 10))
  return (h || 0) * 60 + (m || 0)
}
function isSubmitShortcut(e: React.KeyboardEvent): boolean {
  return (e.metaKey || e.ctrlKey) && e.key === 'Enter'
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

  const doSave = useCallback(async () => {
    if (saving || !summary.trim()) return
    setSaving(true)
    await onSave({ summary, date, startTime, endTime })
    setSaving(false)
    onClose()
  }, [saving, summary, date, startTime, endTime, onSave, onClose])

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
        <button className="btn btn-primary" disabled={saving || !summary.trim()} onClick={doSave}>{saving ? '保存中...' : '保存 (⌘+Enter)'}</button>
        <button className="btn btn-ghost" onClick={onClose}>キャンセル</button>
        {editEvent && onDelete && <button className="btn" style={{ color: 'var(--red)', marginLeft: 'auto' }} disabled={saving} onClick={async () => {
          if (!confirm('削除しますか？')) return; setSaving(true); await onDelete(); setSaving(false); onClose()
        }}>削除</button>}
      </div>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        onKeyDown={e => { if (isSubmitShortcut(e)) { e.preventDefault(); doSave() } }}>
        <div><label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>タイトル</label>
          <input className="input" value={summary} onChange={e => setSummary(e.target.value)} placeholder="イベント名 (⌘+Enter で保存)" autoFocus /></div>
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

function TimeGrid({ events, tasks, days, today, hiddenCalendars, onRangeCreate, onEventClick, onDragUpdate, onTaskToggle, onTaskClick, onAllDayAdd }: {
  events: CalendarEvent[]; tasks: Task[]; days: Date[]; today: string; hiddenCalendars: Set<CalendarType>
  onRangeCreate: (date: string, startHour: number, endHour: number) => void
  onEventClick: (evt: CalendarEvent) => void
  onDragUpdate: (ev: CalendarEvent, newStartH: number, newEndH: number, newDayIndex: number) => Promise<void>
  onTaskToggle: (task: Task) => void
  onTaskClick: (task: Task) => void
  onAllDayAdd: (date: string) => void
}) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const [, setDragRender] = useState(0) // force re-render during drag
  const [hoverCell, setHoverCell] = useState<{ dayIndex: number; hour: number } | null>(null)
  const createDragRef = useRef<{ dayIndex: number; startY: number; currentY: number; moved: boolean } | null>(null)
  const [createDrag, setCreateDrag] = useState<{ dayIndex: number; top: number; height: number } | null>(null)
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

  // Group tasks by day. Time-boxed tasks (scheduled_at) go to time grid; others to all-day row (by due_date)
  const { allDayTasksByDay, timedTasksByDay } = useMemo(() => {
    const allDay = new Map<number, Task[]>()
    const timed = new Map<number, Task[]>()
    for (let i = 0; i < days.length; i++) { allDay.set(i, []); timed.set(i, []) }
    tasks.forEach(t => {
      if (t.scheduled_at) {
        const ds = toJSTDateStr(new Date(t.scheduled_at))
        const di = days.findIndex(d => toJSTDateStr(d) === ds)
        if (di >= 0) timed.get(di)!.push(t)
      } else if (t.due_date) {
        const di = days.findIndex(d => toJSTDateStr(d) === t.due_date)
        if (di >= 0) allDay.get(di)!.push(t)
      }
    })
    return { allDayTasksByDay: allDay, timedTasksByDay: timed }
  }, [tasks, days])

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

  // Drag-to-create on empty cell
  const onCellMouseDown = useCallback((di: number, e: React.MouseEvent) => {
    if (e.button !== 0 || !bodyRef.current) return
    e.preventDefault()
    const bodyRect = bodyRef.current.getBoundingClientRect()
    const startY = snapY(e.clientY - bodyRect.top)
    createDragRef.current = { dayIndex: di, startY, currentY: startY, moved: false }
    setCreateDrag({ dayIndex: di, top: startY, height: SNAP_PX })
    setHoverCell(null)

    const onMove = (me: MouseEvent) => {
      const r = createDragRef.current
      if (!r) return
      const curY = snapY(Math.max(0, Math.min(me.clientY - bodyRect.top, (END_H - START_H) * HOUR_H)))
      if (curY !== r.startY) r.moved = true
      r.currentY = curY
      const top = Math.min(r.startY, curY)
      const height = Math.max(SNAP_PX, Math.abs(curY - r.startY))
      setCreateDrag({ dayIndex: di, top, height })
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      const r = createDragRef.current
      createDragRef.current = null
      setCreateDrag(null)
      if (!r) return
      const top = Math.min(r.startY, r.currentY)
      const bottom = Math.max(r.startY, r.currentY)
      // Click without drag → default 1 hour
      const effectiveBottom = r.moved && (bottom - top) >= SNAP_PX ? bottom : top + HOUR_H
      const startH = yToHours(top)
      const endH = Math.min(yToHours(effectiveBottom), END_H)
      onRangeCreate(toJSTDateStr(days[di]), startH, endH)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [days, onRangeCreate])

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

      {/* All-day row (time-undefined tasks) */}
      <div style={{ display: 'grid', gridTemplateColumns: `56px repeat(${days.length}, 1fr)`, borderBottom: '2px solid var(--border)', background: 'var(--surface2)', minHeight: 44 }}>
        <div style={{ fontSize: 9, color: 'var(--text3)', textAlign: 'right', padding: '6px 8px 0', lineHeight: 1.2 }}>終日<br /><span style={{ color: TASK_COLOR, fontSize: 9 }}>タスク</span></div>
        {days.map((d, di) => {
          const ds = toJSTDateStr(d)
          const dayTasks = allDayTasksByDay.get(di) || []
          return (
            <div key={di} style={{ borderLeft: '1px solid var(--border)', padding: 3, display: 'flex', flexDirection: 'column', gap: 2, position: 'relative', cursor: 'pointer' }}
              onClick={e => { if ((e.target as HTMLElement).dataset.role !== 'chk' && (e.target as HTMLElement).dataset.role !== 'pill') onAllDayAdd(ds) }}
              title="クリックでタスク追加">
              {dayTasks.map(t => {
                const done = t.status === 'done'
                return (
                  <div key={t.id} data-role="pill"
                    onClick={e => { e.stopPropagation(); if ((e.target as HTMLElement).dataset.role !== 'chk') onTaskClick(t) }}
                    style={{
                      background: 'rgba(139,92,246,.15)',
                      border: `1px dashed ${TASK_COLOR}`,
                      color: TASK_COLOR,
                      borderRadius: 3,
                      padding: '2px 6px 2px 22px',
                      fontSize: 10,
                      fontWeight: 500,
                      position: 'relative',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      opacity: done ? 0.45 : 1,
                      textDecoration: done ? 'line-through' : 'none',
                    }}>
                    <span data-role="chk"
                      onClick={e => { e.stopPropagation(); onTaskToggle(t) }}
                      style={{
                        position: 'absolute',
                        left: 5, top: '50%', transform: 'translateY(-50%)',
                        width: 12, height: 12,
                        border: `1.5px solid ${TASK_COLOR}`,
                        borderRadius: 2,
                        background: done ? TASK_COLOR : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: 9, fontWeight: 700,
                        cursor: 'pointer',
                      }}>{done ? '✓' : ''}</span>
                    {t.title}
                  </div>
                )
              })}
              {dayTasks.length === 0 && (
                <div style={{ fontSize: 9, color: 'var(--text3)', opacity: 0.5, padding: '4px 6px', textAlign: 'center' }}>+</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Time grid body */}
      <div ref={bodyRef} className="cal-tg-body" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}
        onMouseLeave={() => setHoverCell(null)}>
        {/* Grid cells */}
        {HOURS.map(h => (
          <React.Fragment key={h}>
            <div className="cal-tg-time">{h > START_H ? `${String(h).padStart(2, '0')}:00` : ''}</div>
            {days.map((_d, di) => (
              <div key={di} className="cal-tg-cell" data-day={di} data-hour={h} style={{ position: 'relative' }}
                onMouseEnter={() => { if (!createDragRef.current) setHoverCell({ dayIndex: di, hour: h }) }}
                onMouseDown={e => { if (!dragRef.current) onCellMouseDown(di, e) }} />
            ))}
          </React.Fragment>
        ))}

        {/* Create drag preview — Google Calendar-style range selection */}
        {createDrag && (
          <div style={{
            position: 'absolute',
            top: createDrag.top,
            left: `calc(56px + ${createDrag.dayIndex} * (100% - 56px) / ${days.length} + 2px)`,
            width: `calc((100% - 56px) / ${days.length} - 4px)`,
            height: createDrag.height - 2,
            background: 'var(--accent)',
            opacity: 0.28,
            border: '2px solid var(--accent)',
            borderRadius: 4,
            pointerEvents: 'none',
            zIndex: 3,
            padding: '4px 6px',
            fontSize: 11,
            fontWeight: 600,
            color: '#fff',
          }}>
            {hoursToTimeStr(yToHours(createDrag.top))}–{hoursToTimeStr(yToHours(createDrag.top + createDrag.height))}
          </div>
        )}

        {/* Hover preview ghost (where the new event will be added) */}
        {hoverCell && !drag && !createDrag && (
          <div style={{
            position: 'absolute',
            top: (hoverCell.hour - START_H) * HOUR_H,
            left: `calc(56px + ${hoverCell.dayIndex} * (100% - 56px) / ${days.length} + 2px)`,
            width: `calc((100% - 56px) / ${days.length} - 4px)`,
            height: HOUR_H - 2,
            background: 'var(--accent)',
            opacity: 0.15,
            borderLeft: '3px solid var(--accent)',
            borderRadius: 4,
            pointerEvents: 'none',
            zIndex: 1,
            display: 'flex',
            alignItems: 'flex-start',
            padding: '4px 6px',
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--accent)',
          }}>
            + {String(hoverCell.hour).padStart(2, '0')}:00
          </div>
        )}

        {/* Events + time-boxed tasks (absolutely positioned) */}
        {days.map((_d, di) => {
          const dayEvts = eventsByDay.get(di) || []
          const dayTimedTasks = timedTasksByDay.get(di) || []
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

                const calLabel = GCAL_CALENDARS.find(c => c.type === evt.calendar_type)?.label || evt.calendar_type
                const bg = CAL_BG_COLORS[evt.calendar_type] || '#5b5fc7'
                return (
                  <div key={evt.id}
                    className={`cal-tg-ev cal-${evt.calendar_type}${isPast ? ' cal-past' : ''}${isDragging ? ' dragging' : ''}`}
                    title={`${fmtTime(evt.start_time)}–${fmtTime(evt.end_time)}  ${evt.summary}\n📅 ${calLabel}`}
                    style={{
                      top, height: height - 2,
                      cursor: evt.all_day ? 'default' : 'grab',
                      pointerEvents: 'auto',
                      background: bg,
                      color: '#fff',
                      borderLeft: `3px solid ${bg}`,
                      filter: 'brightness(1)',
                      paddingLeft: 6,
                    }}
                    onMouseDown={e => { if (!e.defaultPrevented) onEventMouseDown(evt, e) }}>
                    <span className="cal-tg-ev-title" style={{ display: 'block', fontWeight: 600, fontSize: 11, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{evt.summary}</span>
                    {!evt.all_day && (
                      <div className="cal-tg-resize"
                        onMouseDown={e => { e.stopPropagation(); onMouseDown(evt, 'resize', e) }} />
                    )}
                  </div>
                )
              })}

              {/* Time-boxed tasks */}
              {dayTimedTasks.map(t => {
                if (!t.scheduled_at) return null
                const sH = getJSTHours(t.scheduled_at)
                const durH = (t.estimated_minutes || 30) / 60
                const eH = sH + durH
                const top = (sH - START_H) * HOUR_H
                const height = Math.max((eH - sH) * HOUR_H, 28)
                const done = t.status === 'done'
                return (
                  <div key={`task-${t.id}`}
                    title={`${fmtTime(t.scheduled_at)} ${t.title}\n☐ タスク`}
                    style={{
                      position: 'absolute',
                      top,
                      left: 2, right: 2,
                      height: height - 2,
                      background: 'rgba(139,92,246,.12)',
                      border: `1.5px dashed ${TASK_COLOR}`,
                      color: TASK_COLOR,
                      borderRadius: 4,
                      padding: '4px 6px 4px 24px',
                      fontSize: 11,
                      fontWeight: 500,
                      cursor: 'pointer',
                      pointerEvents: 'auto',
                      overflow: 'hidden',
                      opacity: done ? 0.45 : 1,
                      textDecoration: done ? 'line-through' : 'none',
                      zIndex: 2,
                    }}
                    onClick={e => {
                      if ((e.target as HTMLElement).dataset.role !== 'chk') onTaskClick(t)
                    }}>
                    <span data-role="chk"
                      onClick={e => { e.stopPropagation(); onTaskToggle(t) }}
                      style={{
                        position: 'absolute',
                        left: 5, top: 5,
                        width: 14, height: 14,
                        border: `1.5px solid ${TASK_COLOR}`,
                        borderRadius: 3,
                        background: done ? TASK_COLOR : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: 10, fontWeight: 700,
                        cursor: 'pointer',
                      }}>{done ? '✓' : ''}</span>
                    {t.title}
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
// Wellbeing Strip (週ビュー下)
// ============================================================

function WellbeingStrip({ days, layerMap, today, onCellClick }: {
  days: Date[]
  layerMap: CalendarLayerMap
  today: string
  onCellClick: (dateStr: string) => void
}) {
  const dowLabels = ['日', '月', '火', '水', '木', '金', '土']

  return (
    <div style={{
      marginTop: 10,
      padding: '14px 16px',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r)',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text3)', marginBottom: 10 }}>
        Wellbeing
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {days.map((d) => {
          const ds = toJSTDateStr(d)
          const layer = layerMap.get(ds)
          const level = moodLevel(layer?.mood ?? null)
          const bg = moodBgColor(level)
          const isToday = ds === today
          const hasDiary = (layer?.diaryEntries.length || 0) > 0
          return (
            <div
              key={ds}
              onClick={() => onCellClick(ds)}
              style={{
                background: bg || 'var(--surface2)',
                padding: '10px 8px',
                borderRadius: 6,
                textAlign: 'center',
                cursor: 'pointer',
                border: isToday ? '1px solid var(--accent)' : '1px solid var(--border)',
                position: 'relative',
              }}
            >
              <div style={{ fontSize: 10, color: isToday ? 'var(--accent)' : 'var(--text3)', fontWeight: isToday ? 700 : 500 }}>
                {dowLabels[d.getDay()]} {d.getDate()}
              </div>
              <div style={{ fontSize: 18, margin: '4px 0 4px', lineHeight: 1 }}>
                {moodEmoji(level)}
              </div>
              {layer && layer.habitTotals.total > 0 && (
                <div style={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap', marginTop: 2 }}>
                  {layer.habitLogs.slice(0, 8).map((h, k) => (
                    <span
                      key={k}
                      title={h.habitTitle}
                      style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: h.done ? '#16a34a' : 'rgba(161, 161, 170, 0.4)',
                      }}
                    />
                  ))}
                </div>
              )}
              {hasDiary && (
                <span style={{
                  position: 'absolute', top: 6, right: 6,
                  width: 6, height: 6, borderRadius: '50%',
                  background: '#3b82f6',
                }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================
// Month Grid
// ============================================================

function MonthGrid({ events, date, today, hiddenCalendars, layerMap, layers, tasks, onCellClick, onEventClick }: {
  events: CalendarEvent[]; date: Date; today: string; hiddenCalendars: Set<CalendarType>
  layerMap: CalendarLayerMap
  layers: Record<LayerKey, boolean>
  tasks: Task[]
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
  const tasksFor = (ds: string) => tasks.filter(t => t.due_date === ds)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', marginBottom: 4 }}>
        {DOW.map((d, i) => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: i === 0 ? '#ef4444' : i === 6 ? '#3b82f6' : 'var(--text3)', padding: 4 }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px' }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} style={{ minHeight: 96, background: 'var(--surface2)', borderRadius: 4, opacity: 0.3 }} />
          const ds = toJSTDateStr(d), isToday = ds === today, dayEvts = eventsFor(ds)
          const layer = layerMap.get(ds)
          const level = moodLevel(layer?.mood ?? null)
          const moodBg = layers.mood ? moodBgColor(level) : undefined
          const hasDiary = layers.diary && layer && layer.diaryEntries.length > 0
          const showHabits = layers.habits && layer && layer.habitTotals.total > 0
          const dayTasks = layers.tasks ? tasksFor(ds) : []
          const background = isToday
            ? 'var(--accent-bg)'
            : moodBg || 'var(--surface)'
          return (
            <div
              key={i}
              className="cal-day"
              style={{
                minHeight: 96, padding: 8,
                background, cursor: 'pointer', borderRadius: 4,
                position: 'relative',
                border: isToday ? '1px solid var(--accent)' : undefined,
              }}
              onClick={() => onCellClick(ds)}
            >
              {/* Diary marker */}
              {hasDiary && (
                <span style={{
                  position: 'absolute', top: 6, right: 6,
                  width: 7, height: 7, borderRadius: '50%',
                  background: '#3b82f6',
                  boxShadow: '0 0 0 2px var(--surface)',
                }} />
              )}

              <div className="cal-day-hdr" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--accent)' : 'var(--text2)' }}>{d.getDate()}</span>
              </div>

              {/* Habit dots */}
              {showHabits && layer && (
                <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginTop: 2, marginBottom: 2 }}>
                  {layer.habitLogs.slice(0, 10).map((h, k) => (
                    <span
                      key={k}
                      title={h.habitTitle}
                      style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: h.done ? '#16a34a' : 'rgba(161, 161, 170, 0.4)',
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Events */}
              {layers.events && dayEvts.slice(0, 2).map(evt => (
                <div key={evt.id} className={`cal-evt cal-${evt.calendar_type}`}
                  style={{ fontSize: 10, padding: '2px 5px', marginBottom: 2, borderRadius: 3, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', cursor: 'pointer' }}
                  onClick={e => { e.stopPropagation(); onEventClick(evt) }}>
                  <span className="cal-evt-title" style={{ fontSize: 10 }}>{evt.summary.substring(0, 15)}</span>
                </div>
              ))}
              {layers.events && dayEvts.length > 2 && <div style={{ fontSize: 9, color: 'var(--text3)' }}>+{dayEvts.length - 2}</div>}

              {/* Tasks (optional layer) */}
              {dayTasks.slice(0, 2).map(t => (
                <div key={t.id} style={{
                  fontSize: 9, padding: '1px 5px', marginBottom: 2, borderRadius: 3,
                  background: 'rgba(139, 92, 246, 0.15)',
                  color: t.status === 'done' ? 'var(--text3)' : '#7c3aed',
                  textDecoration: t.status === 'done' ? 'line-through' : 'none',
                  overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                }}>
                  {t.title.substring(0, 14)}
                </div>
              ))}
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
    <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
      {GCAL_CALENDARS.map(c => {
        const hidden = hiddenCalendars.has(c.type)
        return (
          <div key={c.id}
            style={{
              cursor: 'pointer',
              opacity: hidden ? 0.4 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: 'var(--text2)',
              padding: '4px 10px',
              borderRadius: 6,
              background: hidden ? 'transparent' : 'var(--surface2)',
              border: '1px solid var(--border)',
              transition: 'all .15s',
              userSelect: 'none',
              textDecoration: hidden ? 'line-through' : 'none',
            }}
            title={hidden ? 'クリックで表示' : 'クリックで非表示'}
            onClick={() => onToggle(c.type)}>
            <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 3, background: CAL_BG_COLORS[c.type], flexShrink: 0 }} />
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
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [hiddenCalendars, setHiddenCalendars] = useState<Set<CalendarType>>(new Set())
  const allStoreTasks = useDataStore((s) => s.tasks)
  const fetchAllTasks = useDataStore((s) => s.fetchTasks)
  const storeUpdateTask = useDataStore((s) => s.updateTask)
  const [quickAdd, setQuickAdd] = useState<{ date: string; startHour?: number; endHour?: number } | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>(() => loadLayers())
  const [drawerDate, setDrawerDate] = useState<string | null>(null)

  const { events, loading, authenticated, refetch, createEvent, updateEvent, deleteEvent } = useGoogleCalendar(viewDate, viewMode)
  const today = toJSTDateStr(new Date())

  // Persist layer toggles
  useEffect(() => {
    try { localStorage.setItem('calendar-layers', JSON.stringify(layers)) } catch { /* ignore */ }
  }, [layers])

  const toggleLayer = useCallback((key: LayerKey) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  // Layer data (diary / habits / mood)
  const layerRange = useMemo(() => {
    if (viewMode === 'month') {
      const start = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1)
      const end = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0)
      start.setDate(start.getDate() - start.getDay())
      while ((end.getDay() + 1) % 7 !== 0) end.setDate(end.getDate() + 1)
      return { start, end }
    }
    if (viewMode === 'week') {
      const start = new Date(viewDate)
      const end = new Date(viewDate); end.setDate(end.getDate() + 6)
      return { start, end }
    }
    return { start: new Date(viewDate), end: new Date(viewDate) }
  }, [viewDate, viewMode])

  const { data: layerMap } = useCalendarLayers(layerRange.start, layerRange.end)

  // Derive visible tasks from the store (single source of truth) and filter
  // to the current view's date range in memory. The store cache covers all
  // user tasks so no date-range query is needed here.
  const tasks = useMemo(() => {
    const range = viewMode === 'day' ? 1 : viewMode === 'week' ? 7 : 35
    const start = new Date(viewDate); start.setDate(start.getDate() - 1)
    const end = new Date(viewDate); end.setDate(end.getDate() + range + 1)
    const startStr = toJSTDateStr(start)
    const endStr = toJSTDateStr(end)
    return allStoreTasks
      .filter((t) => t.type !== 'request')
      .filter((t) => {
        if (t.due_date && t.due_date >= startStr && t.due_date <= endStr) return true
        if (t.scheduled_at) {
          const s = t.scheduled_at
          return s >= start.toISOString() && s <= end.toISOString()
        }
        return false
      })
      .sort((a, b) => a.sort_order - b.sort_order)
  }, [allStoreTasks, viewDate, viewMode])

  useEffect(() => { fetchAllTasks() }, [fetchAllTasks])

  const refreshTasks = useCallback(() => fetchAllTasks({ forceRefresh: true }), [fetchAllTasks])

  const handleTaskToggle = useCallback(async (task: Task) => {
    const nextStatus = task.status === 'done' ? 'open' : 'done'
    const patch = nextStatus === 'done'
      ? { status: 'done' as const, completed_at: new Date().toISOString() }
      : { status: 'open' as const, completed_at: null }
    await storeUpdateTask(task.id, patch)
  }, [storeUpdateTask])

  const handleTaskClick = useCallback((task: Task) => {
    setEditingTask(task)
  }, [])

  const handleAllDayAdd = useCallback((date: string) => {
    setQuickAdd({ date })
  }, [])

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

      {/* Layer toggles — 月ビューのセル表示の切替用なので月のみに表示 */}
      {viewMode === 'month' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', marginRight: 4 }}>
            レイヤー
          </span>
          {LAYER_META.map(({ key, label, swatch }) => {
            const active = layers[key]
            return (
              <button
                key={key}
                onClick={() => toggleLayer(key)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px',
                  fontSize: 11,
                  border: '1px solid var(--border)',
                  borderRadius: 20,
                  background: active ? 'var(--text)' : 'var(--surface)',
                  color: active ? 'var(--surface)' : 'var(--text3)',
                  cursor: 'pointer',
                  transition: 'all .15s',
                }}
              >
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: swatch }} />
                {label}
              </button>
            )
          })}
        </div>
      )}

      {loading && <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Loading...</div>}

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {viewMode === 'month'
          ? <MonthGrid events={events} date={viewDate} today={today} hiddenCalendars={hiddenCalendars}
              layerMap={layerMap} layers={layers} tasks={tasks}
              onCellClick={ds => setDrawerDate(ds)}
              onEventClick={evt => { setEditingEvent(evt); setModalOpen(true) }} />
          : <TimeGrid events={events} tasks={tasks} days={days} today={today} hiddenCalendars={hiddenCalendars}
              onRangeCreate={(ds, startHour, endHour) => setQuickAdd({ date: ds, startHour, endHour })}
              onEventClick={evt => { setEditingEvent(evt); setModalOpen(true) }}
              onDragUpdate={handleDragUpdate}
              onTaskToggle={handleTaskToggle}
              onTaskClick={handleTaskClick}
              onAllDayAdd={handleAllDayAdd} />
        }
      </Card>

      {/* Wellbeing Strip (週ビュー下) */}
      {viewMode === 'week' && (
        <WellbeingStrip days={days} layerMap={layerMap} today={today} onCellClick={setDrawerDate} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>{events.length} events</div>
        <CalendarLegend hiddenCalendars={hiddenCalendars} onToggle={toggleCalendar} />
      </div>

      <EventModal open={modalOpen} onClose={() => setModalOpen(false)}
        editEvent={editingEvent} onSave={handleSave} onDelete={editingEvent ? handleDelete : undefined} />

      {quickAdd && (
        <QuickAddPopover
          date={quickAdd.date}
          startHour={quickAdd.startHour}
          endHour={quickAdd.endHour}
          onClose={() => setQuickAdd(null)}
          onCreatedTask={() => { setQuickAdd(null); refreshTasks() }}
          onCreateEvent={async (form) => {
            await handleSave(form)
            setQuickAdd(null)
          }}
        />
      )}

      {editingTask && (
        <TaskEditModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSaved={() => { setEditingTask(null); refreshTasks() }}
        />
      )}

      <DayDetailDrawer
        dateStr={drawerDate}
        layer={drawerDate ? (layerMap.get(drawerDate) || null) : null}
        events={drawerDate ? events.filter(e => toJSTDateStr(new Date(e.start_time)) === drawerDate && !hiddenCalendars.has(e.calendar_type)) : []}
        tasks={drawerDate ? tasks.filter(t => t.due_date === drawerDate) : []}
        onClose={() => setDrawerDate(null)}
      />
    </div>
  )
}

// ============================================================
// Quick Add Popover — unified task/event creator with toggle
// ============================================================

function QuickAddPopover({ date, startHour, endHour, onClose, onCreatedTask, onCreateEvent }: {
  date: string; startHour?: number; endHour?: number
  onClose: () => void
  onCreatedTask: () => void
  onCreateEvent: (form: { summary: string; date: string; startTime: string; endTime: string }) => Promise<void>
}) {
  const [kind, setKind] = useState<'task' | 'event'>('task')
  const [title, setTitle] = useState('')
  const hasRange = startHour !== undefined && endHour !== undefined
  const defaultStart = hasRange ? hoursToTimeStr(startHour!) : '10:00'
  const defaultEnd = hasRange ? hoursToTimeStr(endHour!) : '11:00'
  const [startTime, setStartTime] = useState(defaultStart)
  const [endTime, setEndTime] = useState(defaultEnd)
  // Time is opt-in for all-day slots (no drag range), auto-on for time-grid slots.
  const [hasTime, setHasTime] = useState(hasRange)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const addTaskToStore = useDataStore((s) => s.addTask)

  const create = async () => {
    const t = title.trim()
    if (!t || saving) return
    setSaving(true)
    if (kind === 'task') {
      const minutes = hasTime ? Math.max(5, timeStrToMinutes(endTime) - timeStrToMinutes(startTime)) : null
      const created = await addTaskToStore({
        title: t,
        type: 'task',
        priority: 'normal',
        due_date: date,
        scheduled_at: hasTime ? `${date}T${startTime}:00+09:00` : null,
        estimated_minutes: minutes,
      })
      setSaving(false)
      if (!created) { toast('追加に失敗しました'); return }
      toast('タスクを追加しました')
      onCreatedTask()
    } else {
      await onCreateEvent({ summary: t, date, startTime, endTime })
      setSaving(false)
    }
  }

  const pillStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#fff' : 'var(--text3)',
    borderRadius: 6,
    transition: 'all .15s',
    fontFamily: 'var(--font)',
  })

  const isAllDay = !hasRange

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 250, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      onKeyDown={e => {
        if (isSubmitShortcut(e)) { e.preventDefault(); create() }
        if (e.key === 'Escape') onClose()
      }}>
      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 20, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,.4)', border: '1px solid var(--border)' }}>

        {/* Type toggle */}
        <div style={{ display: 'flex', gap: 4, padding: 3, background: 'var(--surface2)', borderRadius: 8, marginBottom: 14 }}>
          <button style={pillStyle(kind === 'task')} onClick={() => setKind('task')}>
            ☐ タスク
          </button>
          <button style={pillStyle(kind === 'event')} onClick={() => setKind('event')}>
            ■ 予定
          </button>
        </div>

        {/* Context label */}
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>
          {isAllDay ? `${date}  終日` : `${date}  ${defaultStart}〜${defaultEnd}`}
        </div>

        {/* Title input */}
        <input
          ref={inputRef}
          className="input"
          style={{ width: '100%', marginBottom: 12, fontSize: 14 }}
          placeholder={kind === 'task' ? '何をしますか？' : '予定のタイトル'}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => {
            // Enter is NOT a submit shortcut — prevent default form submit-on-Enter only.
            if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) e.preventDefault()
          }}
        />

        {/* Time inputs — unified for task and event */}
        {(!isAllDay || kind === 'event') && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>開始</label>
              <input className="input" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>終了</label>
              <input className="input" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
          </div>
        )}

        {/* All-day task: opt-in time range */}
        {isAllDay && kind === 'task' && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: hasTime ? 6 : 0, cursor: 'pointer' }}>
              <input type="checkbox" checked={hasTime} onChange={e => setHasTime(e.target.checked)} />
              時間を指定する
            </label>
            {hasTime && (
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>開始</label>
                  <input className="input" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>終了</label>
                  <input className="input" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-primary" disabled={!title.trim() || saving} onClick={create}>
            {saving ? '作成中...' : `+ ${kind === 'task' ? 'タスク' : '予定'}追加`}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>キャンセル</button>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 10, color: 'var(--text3)' }}>⌘+Enter で確定 · Esc で閉じる</span>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Task Edit Modal — edit or delete a task
// ============================================================

function TaskEditModal({ task, onClose, onSaved }: { task: Task; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(task.title)
  const [dueDate, setDueDate] = useState(task.due_date || '')
  const [hasTime, setHasTime] = useState(!!task.scheduled_at)
  const [startTime, setStartTime] = useState(task.scheduled_at ? fmtTime(task.scheduled_at) : '10:00')
  const [minutes, setMinutes] = useState(String(task.estimated_minutes || 60))
  const [saving, setSaving] = useState(false)
  const updateTaskInStore = useDataStore((s) => s.updateTask)
  const deleteTaskInStore = useDataStore((s) => s.deleteTask)

  const save = async () => {
    setSaving(true)
    const patch: Partial<Task> = { title: title.trim(), due_date: dueDate || null }
    if (hasTime && dueDate) {
      patch.scheduled_at = `${dueDate}T${startTime}:00+09:00`
      patch.estimated_minutes = parseInt(minutes) || 60
    } else {
      patch.scheduled_at = null
    }
    await updateTaskInStore(task.id, patch)
    setSaving(false)
    toast('更新しました')
    onSaved()
  }

  const del = async () => {
    if (!confirm('このタスクを削除しますか？')) return
    await deleteTaskInStore(task.id)
    toast('削除しました')
    onSaved()
  }

  return (
    <Modal open onClose={onClose} title="タスクを編集"
      footer={<div style={{ display: 'flex', gap: 8, width: '100%' }}>
        <button className="btn btn-primary" disabled={saving || !title.trim()} onClick={save}>{saving ? '保存中...' : '保存'}</button>
        <button className="btn btn-ghost" onClick={onClose}>キャンセル</button>
        <button className="btn" style={{ color: 'var(--red)', marginLeft: 'auto' }} onClick={del}>削除</button>
      </div>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>タイトル</label>
          <input className="input" value={title} onChange={e => setTitle(e.target.value)} autoFocus /></div>
        <div><label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>日付</label>
          <input className="input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <input type="checkbox" checked={hasTime} onChange={e => setHasTime(e.target.checked)} />
          時間を指定する
        </label>
        {hasTime && (
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}><label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>開始</label>
              <input className="input" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} /></div>
            <div style={{ flex: 1 }}><label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>所要（分）</label>
              <input className="input" type="number" value={minutes} onChange={e => setMinutes(e.target.value)} /></div>
          </div>
        )}
      </div>
    </Modal>
  )
}
