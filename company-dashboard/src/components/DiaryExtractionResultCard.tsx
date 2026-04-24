import { useState } from 'react'
import { Card } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { toast } from '@/components/ui/Toast'
import { useDataStore } from '@/stores/data'
import type { DiaryExtractionResult, MoodSuggestion, NewTaskSuggestion, TaskTimeMode, TripLookup } from '@/hooks/useDiaryExtraction'

interface RouteOption {
  summary: string
  durationMinutes: number
  departureTime: string | null
  arrivalTime: string | null
  fareYen: number | null
  steps: string[]
}

interface TripLookupResult {
  ok: boolean
  origin: string
  destination: string
  departureTime: string
  routes: RouteOption[]
}

interface Props {
  result: DiaryExtractionResult
  onDismiss: () => void
  /** Called after any confirm/undo action so parent can refresh tasks/habits. */
  onChanged: () => void
}

/**
 * Small card displayed right after diary submit. Shows what the system auto-recorded
 * from the entry and lets the user confirm suggestions or undo auto-decisions.
 *
 * Design principle: the system always surfaces what it did. Precision may be imperfect,
 * so every auto-action is reversible in one click and every suggestion is opt-in.
 */
export function DiaryExtractionResultCard({ result, onDismiss, onChanged }: Props) {
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  /** Track which new-task rows are expanded for time/mode editing. Keyed by title. */
  const [expandedNewTask, setExpandedNewTask] = useState<string | null>(null)
  /** Track which new-task rows were successfully added so we can hide them afterward. */
  const [addedTasks, setAddedTasks] = useState<Set<string>>(new Set())
  const addTaskToStore = useDataStore((s) => s.addTask)

  const mark = (key: string) => setPendingIds((s) => new Set(s).add(key))
  const unmark = (key: string) =>
    setPendingIds((s) => {
      const next = new Set(s)
      next.delete(key)
      return next
    })

  const undoTask = async (taskId: string, title: string) => {
    const key = `undo-task-${taskId}`
    mark(key)
    try {
      await supabase.from('tasks').update({ status: 'open', completed_at: null, source: null }).eq('id', taskId)
      toast(`「${title}」を未完了に戻しました`)
      onChanged()
    } finally {
      unmark(key)
    }
  }

  const undoHabit = async (habitId: number, title: string) => {
    const key = `undo-habit-${habitId}`
    mark(key)
    try {
      const today = new Date().toISOString().substring(0, 10)
      await supabase
        .from('habit_logs')
        .delete()
        .eq('habit_id', habitId)
        .gte('completed_at', `${today}T00:00:00`)
        .like('note', '[auto]%')
      toast(`「${title}」の自動記録を取り消しました`)
      onChanged()
    } finally {
      unmark(key)
    }
  }

  const confirmDoneTask = async (taskId: string, title: string) => {
    const key = `confirm-task-${taskId}`
    mark(key)
    try {
      await supabase
        .from('tasks')
        .update({ status: 'done', completed_at: new Date().toISOString(), source: 'auto:diary-extract' })
        .eq('id', taskId)
      toast(`「${title}」を完了に`)
      onChanged()
    } finally {
      unmark(key)
    }
  }

  const confirmDoneHabit = async (habitId: number, title: string) => {
    const key = `confirm-habit-${habitId}`
    mark(key)
    try {
      await supabase.from('habit_logs').insert({
        habit_id: habitId,
        completed_at: new Date().toISOString(),
        note: '[auto] 日記から検出（手動承認）',
      })
      toast(`「${title}」を記録しました`)
      onChanged()
    } finally {
      unmark(key)
    }
  }

  const hasAuto = result.done_tasks.some((d) => d.confidence === 'high') || result.done_habits.some((d) => d.confidence === 'high')
  const hasSuggestions =
    result.done_tasks.some((d) => d.confidence !== 'high') ||
    result.done_habits.some((d) => d.confidence !== 'high') ||
    result.new_tasks.length > 0 ||
    result.new_habit_suggestions.length > 0

  if (!hasAuto && !hasSuggestions) return null

  return (
    <Card style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
          🤖 日記から検出
        </div>
        <button
          onClick={onDismiss}
          style={{ fontSize: 11, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          閉じる
        </button>
      </div>

      {/* Auto-checked tasks (high confidence) */}
      {result.done_tasks.filter((d) => d.confidence === 'high').map((d) => {
        const key = `undo-task-${d.task_id}`
        return (
          <div key={key} style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6, display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ color: 'var(--green)' }}>✓ 自動</span>
            <span style={{ flex: 1 }}>タスク「{d.task_title}」を完了にしました</span>
            {d.quote && <span style={{ fontSize: 10, color: 'var(--text3)' }}>「{d.quote}」</span>}
            <button
              className="btn btn-g btn-sm"
              disabled={pendingIds.has(key)}
              onClick={() => undoTask(d.task_id, d.task_title)}
              style={{ fontSize: 10, padding: '2px 8px' }}
            >
              戻す
            </button>
          </div>
        )
      })}

      {/* Auto-checked habits (high confidence) */}
      {result.done_habits.filter((d) => d.confidence === 'high').map((d) => {
        const key = `undo-habit-${d.habit_id}`
        return (
          <div key={key} style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6, display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ color: 'var(--green)' }}>✓ 自動</span>
            <span style={{ flex: 1 }}>習慣「{d.habit_title}」を記録しました</span>
            {d.quote && <span style={{ fontSize: 10, color: 'var(--text3)' }}>「{d.quote}」</span>}
            <button
              className="btn btn-g btn-sm"
              disabled={pendingIds.has(key)}
              onClick={() => undoHabit(d.habit_id, d.habit_title)}
              style={{ fontSize: 10, padding: '2px 8px' }}
            >
              戻す
            </button>
          </div>
        )
      })}

      {/* Medium-confidence task completions (confirm or ignore) */}
      {result.done_tasks.filter((d) => d.confidence !== 'high').map((d) => {
        const key = `confirm-task-${d.task_id}`
        return (
          <div key={key} style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6, display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ color: 'var(--amber)' }}>💡</span>
            <span style={{ flex: 1 }}>タスク「{d.task_title}」を完了にしますか？</span>
            {d.quote && <span style={{ fontSize: 10, color: 'var(--text3)' }}>「{d.quote}」</span>}
            <button
              className="btn btn-p btn-sm"
              disabled={pendingIds.has(key)}
              onClick={() => confirmDoneTask(d.task_id, d.task_title)}
              style={{ fontSize: 10, padding: '2px 8px' }}
            >
              完了に
            </button>
          </div>
        )
      })}

      {/* Medium-confidence habit completions */}
      {result.done_habits.filter((d) => d.confidence !== 'high').map((d) => {
        const key = `confirm-habit-${d.habit_id}`
        return (
          <div key={key} style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6, display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ color: 'var(--amber)' }}>💡</span>
            <span style={{ flex: 1 }}>習慣「{d.habit_title}」を記録しますか？</span>
            {d.quote && <span style={{ fontSize: 10, color: 'var(--text3)' }}>「{d.quote}」</span>}
            <button
              className="btn btn-p btn-sm"
              disabled={pendingIds.has(key)}
              onClick={() => confirmDoneHabit(d.habit_id, d.habit_title)}
              style={{ fontSize: 10, padding: '2px 8px' }}
            >
              記録
            </button>
          </div>
        )
      })}

      {/* New task suggestions (with expandable time/mode editor) */}
      {result.new_tasks.filter((n) => !addedTasks.has(n.title)).map((n) => {
        const expanded = expandedNewTask === n.title
        const pendingKey = `new-task-${n.title}`
        return (
          <NewTaskRow
            key={`new-task-${n.title}`}
            suggestion={n}
            expanded={expanded}
            pending={pendingIds.has(pendingKey)}
            onToggleExpand={() => setExpandedNewTask(expanded ? null : n.title)}
            onSave={async (form) => {
              mark(pendingKey)
              try {
                const created = await addTaskToStore(buildTaskPayload(form))
                if (!created) {
                  toast('追加に失敗しました')
                  return
                }
                setAddedTasks((s) => new Set(s).add(n.title))
                setExpandedNewTask(null)
                toast(`タスク「${form.title}」を追加しました`)
                onChanged()
              } finally {
                unmark(pendingKey)
              }
            }}
          />
        )
      })}

      {/* Trip lookups (concrete transit info via Google Routes) */}
      {result.trip_lookups.map((trip, i) => (
        <TripLookupRow
          key={`trip-${i}-${trip.destination}`}
          trip={trip}
          onAddTask={async (routeDescription, departureIso) => {
            const date = departureIso ? departureIso.substring(0, 10) : null
            const time = departureIso ? new Date(departureIso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tokyo' }) : null
            const created = await addTaskToStore({
              title: `${trip.destination}へ`,
              description: routeDescription,
              type: 'task',
              priority: 'normal',
              source: 'auto:diary-extract',
              due_date: date,
              scheduled_at: date && time ? `${date}T${time}:00+09:00` : null,
            })
            if (!created) {
              toast('追加に失敗しました')
              return
            }
            toast(`「${trip.destination}へ」をタスクに追加しました`)
            onChanged()
          }}
        />
      ))}

      {/* Mood suggestions (emotion-driven candidates) */}
      {result.mood_suggestions.map((m, i) => (
        <MoodSuggestionRow
          key={`mood-${i}-${m.topic}`}
          suggestion={m}
          onAddTask={async (candidate) => {
            const created = await addTaskToStore({
              title: candidate.title,
              description: candidate.description,
              type: 'task',
              priority: 'normal',
              source: 'auto:diary-extract',
            })
            if (!created) {
              toast('追加に失敗しました')
              return
            }
            toast(`「${candidate.title}」をタスクに追加しました`)
            onChanged()
          }}
        />
      ))}

      {/* New habit suggestions (only surface; don't create — habits have metadata) */}
      {result.new_habit_suggestions.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          習慣候補: {result.new_habit_suggestions.map((n) => `「${n.title}」`).join('、')}
          <span style={{ marginLeft: 8 }}>— Habitsページから正式登録できます</span>
        </div>
      )}
    </Card>
  )
}

/**
 * Form state produced by {@link NewTaskRow} and consumed by {@link buildTaskPayload}.
 */
interface NewTaskForm {
  title: string
  mode: TaskTimeMode
  /** YYYY-MM-DD; required for 'deadline' and 'scheduled'. */
  date: string
  /** HH:MM; required for 'scheduled', optional for 'deadline'. */
  time: string
  /** Minutes of focused work; used only for 'scheduled'. */
  minutes: number
}

/**
 * Convert the UI form into the payload that useDataStore.addTask accepts.
 *
 * Three modes produce three shapes:
 *  - scheduled: scheduled_at (timeline slot) + due_date + estimated_minutes
 *  - deadline: deadline_at (if time given) or due_date (date-only)
 *  - none: no date fields — goes to backlog
 */
function buildTaskPayload(form: NewTaskForm) {
  const base = {
    title: form.title,
    type: 'task',
    priority: 'normal',
    source: 'auto:diary-extract',
  }
  if (form.mode === 'scheduled') {
    return {
      ...base,
      due_date: form.date,
      scheduled_at: `${form.date}T${form.time}:00+09:00`,
      estimated_minutes: form.minutes,
    }
  }
  if (form.mode === 'deadline') {
    if (form.time) {
      return { ...base, due_date: form.date, deadline_at: `${form.date}T${form.time}:00+09:00` }
    }
    return { ...base, due_date: form.date }
  }
  return base
}

interface NewTaskRowProps {
  suggestion: NewTaskSuggestion
  expanded: boolean
  pending: boolean
  onToggleExpand: () => void
  onSave: (form: NewTaskForm) => Promise<void>
}

function formatDateHint(date: string | null, time: string | null, mode: TaskTimeMode): string {
  if (!date || mode === 'none') return ''
  const todayYmd = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
  const tomorrowYmd = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
  const dateLabel =
    date === todayYmd ? '今日'
    : date === tomorrowYmd ? '明日'
    : new Date(`${date}T00:00:00+09:00`).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'Asia/Tokyo' })
  if (mode === 'scheduled') {
    return time ? `${dateLabel} ${time}` : dateLabel
  }
  if (mode === 'deadline') {
    return time ? `${dateLabel} ${time}` : dateLabel
  }
  return ''
}

function NewTaskRow({ suggestion, expanded, pending, onToggleExpand, onSave }: NewTaskRowProps) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
  const [title, setTitle] = useState(suggestion.title)
  const [mode, setMode] = useState<TaskTimeMode>(suggestion.suggested_mode)
  // For 'none' mode, don't pre-fill date — let user pick when they switch to another mode.
  const [date, setDate] = useState(suggestion.suggested_date ?? (suggestion.suggested_mode !== 'none' ? today : ''))
  const [time, setTime] = useState(suggestion.suggested_time ?? (suggestion.suggested_mode === 'scheduled' ? '10:00' : ''))
  const [minutes, setMinutes] = useState(suggestion.suggested_minutes ?? 30)

  const modeLabel: Record<TaskTimeMode, string> = {
    scheduled: '作業ブロック',
    deadline: '締切',
    none: '未定',
  }

  const handleSave = () => {
    if (!title.trim() || pending) return
    onSave({ title: title.trim(), mode, date, time, minutes })
  }

  const dateHint = formatDateHint(suggestion.suggested_date, suggestion.suggested_time, suggestion.suggested_mode)

  return (
    <div
      style={{
        marginBottom: expanded ? 10 : 6,
        padding: expanded ? '8px 10px' : 0,
        background: expanded ? 'var(--surface2)' : 'transparent',
        borderRadius: expanded ? 6 : 0,
        border: expanded ? '1px solid var(--border)' : 'none',
        transition: 'all .15s',
      }}
    >
      {/* Collapsed row */}
      <div style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ color: 'var(--accent2)' }}>＋</span>
        <span style={{ flex: 1 }}>
          新タスク候補: 「{suggestion.title}」
          <span
            style={{
              fontSize: 10,
              marginLeft: 8,
              padding: '1px 6px',
              background: 'var(--bg)',
              borderRadius: 10,
              color: suggestion.suggested_mode === 'none' ? 'var(--text3)' : 'var(--accent)',
            }}
          >
            {modeLabel[suggestion.suggested_mode]}
            {dateHint && <span style={{ marginLeft: 4 }}>{dateHint}</span>}
            {suggestion.suggested_mode === 'scheduled' && suggestion.suggested_minutes && (
              <span style={{ marginLeft: 4, opacity: 0.7 }}>{suggestion.suggested_minutes}分</span>
            )}
          </span>
        </span>
        {suggestion.quote && <span style={{ fontSize: 10, color: 'var(--text3)' }}>「{suggestion.quote}」</span>}
        <button
          className="btn btn-p btn-sm"
          disabled={pending}
          onClick={onToggleExpand}
          style={{ fontSize: 10, padding: '2px 8px' }}
        >
          {expanded ? '閉じる' : '追加 ▼'}
        </button>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {suggestion.reasoning && (
            <div style={{ fontSize: 10, color: 'var(--text3)', fontStyle: 'italic' }}>
              AI: {suggestion.reasoning}
            </div>
          )}

          {/* Title (editable) */}
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ fontSize: 12 }}
            placeholder="タスク名"
          />

          {/* Mode selector */}
          <div style={{ display: 'flex', gap: 4 }}>
            {(['scheduled', 'deadline', 'none'] as TaskTimeMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m)
                  // Fill in sensible defaults when switching from 'none' to a timed mode
                  if (m !== 'none' && !date) setDate(today)
                  if (m === 'scheduled' && !time) setTime('10:00')
                }}
                style={{
                  flex: 1,
                  fontSize: 11,
                  padding: '5px 8px',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  background: mode === m ? 'var(--accent)' : 'transparent',
                  color: mode === m ? '#fff' : 'var(--text2)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font)',
                  fontWeight: mode === m ? 600 : 400,
                }}
              >
                {modeLabel[m]}
              </button>
            ))}
          </div>

          {/* Date/time inputs depend on mode */}
          {mode === 'scheduled' && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 110 }}>
                <label style={{ fontSize: 10, color: 'var(--text3)', display: 'block', marginBottom: 2 }}>日付</label>
                <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ fontSize: 12, width: '100%' }} />
              </div>
              <div style={{ width: 90 }}>
                <label style={{ fontSize: 10, color: 'var(--text3)', display: 'block', marginBottom: 2 }}>開始</label>
                <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ fontSize: 12, width: '100%' }} />
              </div>
              <div style={{ width: 80 }}>
                <label style={{ fontSize: 10, color: 'var(--text3)', display: 'block', marginBottom: 2 }}>所要分</label>
                <input
                  className="input"
                  type="number"
                  min={5}
                  step={5}
                  value={minutes}
                  onChange={(e) => setMinutes(Math.max(5, Number(e.target.value) || 30))}
                  style={{ fontSize: 12, width: '100%' }}
                />
              </div>
            </div>
          )}

          {mode === 'deadline' && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, color: 'var(--text3)', display: 'block', marginBottom: 2 }}>締切日</label>
                <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ fontSize: 12, width: '100%' }} />
              </div>
              <div style={{ width: 110 }}>
                <label style={{ fontSize: 10, color: 'var(--text3)', display: 'block', marginBottom: 2 }}>時刻（任意）</label>
                <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ fontSize: 12, width: '100%' }} />
              </div>
            </div>
          )}

          {mode === 'none' && (
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>
              日時なしで追加します（バックログ行き）
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <button
              className="btn btn-primary btn-sm"
              disabled={!title.trim() || pending}
              onClick={handleSave}
              style={{ fontSize: 11, padding: '4px 12px' }}
            >
              {pending ? '保存中...' : '保存'}
            </button>
            <button
              className="btn btn-g btn-sm"
              disabled={pending}
              onClick={onToggleExpand}
              style={{ fontSize: 11, padding: '4px 12px' }}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Trip lookup — concrete transit info via Google Routes Edge Function
// ============================================================

interface TripLookupRowProps {
  trip: TripLookup
  onAddTask: (routeDescription: string, departureIso: string | null) => Promise<void>
}

function TripLookupRow({ trip, onAddTask }: TripLookupRowProps) {
  const [loading, setLoading] = useState(false)
  const [routes, setRoutes] = useState<RouteOption[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const lookup = async () => {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const res = await fetch(import.meta.env.VITE_SUPABASE_URL + '/functions/v1/trip-lookup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ origin: trip.origin, destination: trip.destination, when: trip.when }),
      })
      const body = await res.json() as TripLookupResult | { error: string }
      if (!res.ok || 'error' in body) {
        setError('error' in body ? body.error : 'ルート取得に失敗しました')
        setRoutes(null)
      } else {
        setRoutes(body.routes)
        setExpanded(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ルート取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginBottom: 8, padding: '8px 10px', background: 'var(--surface2)', borderRadius: 6, border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ color: 'var(--accent)' }}>🚉</span>
        <span style={{ flex: 1 }}>
          {trip.origin ? `${trip.origin} → ` : ''}<strong>{trip.destination}</strong>
          <span style={{ marginLeft: 8, color: 'var(--text3)', fontSize: 11 }}>（{trip.when}）</span>
        </span>
        {trip.quote && <span style={{ fontSize: 10, color: 'var(--text3)' }}>「{trip.quote}」</span>}
        {!routes && (
          <button
            className="btn btn-p btn-sm"
            disabled={loading}
            onClick={lookup}
            style={{ fontSize: 10, padding: '2px 8px' }}
          >
            {loading ? '調査中...' : 'ルート調査'}
          </button>
        )}
      </div>
      {trip.reasoning && (
        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4, fontStyle: 'italic' }}>
          AI: {trip.reasoning}
        </div>
      )}
      {error && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 6 }}>{error}</div>}
      {routes && expanded && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {routes.length === 0 && <div style={{ fontSize: 11, color: 'var(--text3)' }}>ルートが見つかりませんでした</div>}
          {routes.map((route, i) => (
            <RouteCard
              key={i}
              route={route}
              destination={trip.destination}
              onAdd={() => onAddTask(formatRouteDescription(route, trip), route.departureTime)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function formatRouteDescription(route: RouteOption, trip: TripLookup): string {
  const lines: string[] = []
  if (route.departureTime) {
    const dep = new Date(route.departureTime).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
    lines.push(`発: ${dep}`)
  }
  if (route.arrivalTime) {
    const arr = new Date(route.arrivalTime).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
    lines.push(`着: ${arr}`)
  }
  if (route.durationMinutes) lines.push(`所要: ${formatDuration(route.durationMinutes)}`)
  if (route.fareYen !== null) lines.push(`運賃: ¥${route.fareYen.toLocaleString('ja-JP')}`)
  if (route.steps.length > 0) lines.push(`経路: ${route.steps.join(' / ')}`)
  if (trip.quote) lines.push(`日記: 「${trip.quote}」`)
  return lines.join('\n')
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}分`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}時間` : `${h}時間${m}分`
}

function RouteCard({ route, destination, onAdd }: { route: RouteOption; destination: string; onAdd: () => void }) {
  const dep = route.departureTime ? new Date(route.departureTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) : null
  const arr = route.arrivalTime ? new Date(route.arrivalTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) : null
  return (
    <div style={{ padding: '6px 8px', background: 'var(--surface)', borderRadius: 4, fontSize: 11 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
        <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--text)' }}>
          {dep || '—'} → {arr || '—'}
        </span>
        <span style={{ color: 'var(--text3)' }}>{formatDuration(route.durationMinutes)}</span>
        {route.fareYen !== null && <span style={{ color: 'var(--text3)' }}>¥{route.fareYen.toLocaleString('ja-JP')}</span>}
        <div style={{ flex: 1 }} />
        <button
          className="btn btn-p btn-sm"
          onClick={onAdd}
          style={{ fontSize: 10, padding: '2px 8px' }}
          title={`${destination} へのタスクに追加`}
        >
          タスクに
        </button>
      </div>
      {route.steps.length > 0 && (
        <div style={{ color: 'var(--text2)', lineHeight: 1.5 }}>
          {route.steps.join(' → ')}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Mood suggestion — soft candidates surfaced from emotional cues
// ============================================================

interface MoodSuggestionRowProps {
  suggestion: MoodSuggestion
  onAddTask: (candidate: { title: string; description: string }) => Promise<void>
}

function MoodSuggestionRow({ suggestion, onAddTask }: MoodSuggestionRowProps) {
  const icon: Record<MoodSuggestion['topic'], string> = {
    trip: '🧳',
    meal: '🍜',
    activity: '🎯',
    rest: '🛋️',
    other: '✨',
  }
  const label: Record<MoodSuggestion['topic'], string> = {
    trip: '旅行',
    meal: '食事',
    activity: 'アクティビティ',
    rest: '休息',
    other: 'その他',
  }

  return (
    <div style={{ marginBottom: 8, padding: '8px 10px', background: 'var(--surface2)', borderRadius: 6, border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span>{icon[suggestion.topic]}</span>
        <span style={{ fontWeight: 600, color: 'var(--text2)' }}>{label[suggestion.topic]}の候補</span>
        {suggestion.quote && <span style={{ fontSize: 10 }}>「{suggestion.quote}」</span>}
      </div>
      {suggestion.reasoning && (
        <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6, fontStyle: 'italic' }}>
          AI: {suggestion.reasoning}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {suggestion.candidates.map((c, i) => (
          <div
            key={i}
            style={{ padding: '6px 8px', background: 'var(--surface)', borderRadius: 4, display: 'flex', alignItems: 'baseline', gap: 8 }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>{c.title}</div>
              {c.description && <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2, lineHeight: 1.5 }}>{c.description}</div>}
            </div>
            <button
              className="btn btn-p btn-sm"
              onClick={() => onAddTask(c)}
              style={{ fontSize: 10, padding: '2px 8px', flexShrink: 0 }}
            >
              タスクに
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
