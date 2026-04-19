import { useState } from 'react'
import { Card } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { toast } from '@/components/ui/Toast'
import { useDataStore } from '@/stores/data'
import type { DiaryExtractionResult, NewTaskSuggestion, TaskTimeMode } from '@/hooks/useDiaryExtraction'

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

function NewTaskRow({ suggestion, expanded, pending, onToggleExpand, onSave }: NewTaskRowProps) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
  const [title, setTitle] = useState(suggestion.title)
  const [mode, setMode] = useState<TaskTimeMode>(suggestion.suggested_mode)
  const [date, setDate] = useState(suggestion.suggested_date ?? today)
  const [time, setTime] = useState(suggestion.suggested_time ?? '10:00')
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
              color: 'var(--text3)',
            }}
          >
            推奨: {modeLabel[suggestion.suggested_mode]}
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
                onClick={() => setMode(m)}
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
