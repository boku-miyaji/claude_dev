import { useState } from 'react'
import { Card } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { toast } from '@/components/ui/Toast'
import type { DiaryExtractionResult } from '@/hooks/useDiaryExtraction'

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

  const addNewTask = async (title: string) => {
    const key = `new-task-${title}`
    mark(key)
    try {
      await supabase.from('tasks').insert({
        title,
        status: 'open',
        priority: 'normal',
        source: 'auto:diary-extract',
      })
      toast(`タスク「${title}」を追加しました`)
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

      {/* New task suggestions */}
      {result.new_tasks.map((n) => {
        const key = `new-task-${n.title}`
        return (
          <div key={key} style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6, display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ color: 'var(--accent2)' }}>＋</span>
            <span style={{ flex: 1 }}>新タスク候補: 「{n.title}」</span>
            {n.quote && <span style={{ fontSize: 10, color: 'var(--text3)' }}>「{n.quote}」</span>}
            <button
              className="btn btn-p btn-sm"
              disabled={pendingIds.has(key)}
              onClick={() => addNewTask(n.title)}
              style={{ fontSize: 10, padding: '2px 8px' }}
            >
              追加
            </button>
          </div>
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
