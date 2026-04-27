import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { calculateStreak } from '@/lib/streak'
import { Card } from '@/components/ui'
import { useEmotionAnalysis } from '@/hooks/useEmotionAnalysis'
import { useMomentDetector } from '@/hooks/useMomentDetector'
import { useDiaryExtraction, type DiaryExtractionResult } from '@/hooks/useDiaryExtraction'
import { DiaryExtractionResultCard } from '@/components/DiaryExtractionResultCard'
import { PendingUpdatesBanner } from '@/components/PendingUpdatesBanner'
import { TodayIdeasCard } from '@/components/TodayIdeasCard'
import { useTodayWeather } from '@/hooks/useTodayWeather'
import { useTodayTimeline } from '@/hooks/useTodayTimeline'
import { toast } from '@/components/ui'
import { FutureYouChat } from '@/components/FutureYouChat'
import { StoryUpdateBanner } from '@/components/StoryUpdateBanner'
import { MorningQuoteCard } from '@/components/MorningQuoteCard'
import { ProactivePreludeCard } from '@/components/ProactivePreludeCard'
import { useDataStore } from '@/stores/data'
import { useAuthStore } from '@/stores/auth'
import { getTimeMode, getGreeting, formatToday, getDiaryPrompt } from '@/lib/timeMode'
import type { TimeMode } from '@/lib/timeMode'
import type { DiaryEntry } from '@/types/diary'

// Analysis questions for diary input — src/lib/diaryPrompts.ts に良問いライブラリとして集約済み
// 価値観・幸せ・失敗パターン・行動・人間関係・意思決定・内面・ポジティブ の 7軸構造
import { getTodayQuestions } from '@/lib/diaryPrompts'
import { useSimilarPastEntry } from '@/hooks/useSimilarPastEntry'
import { supabase } from '@/lib/supabase'
import { uploadDiaryImage } from '@/lib/diaryImages'
import { DiaryImageThumb } from '@/components/DiaryImageThumb'
import { startCalendarAuth } from '@/lib/calendarApi'

/* ── Constants ── */

const PLUTCHIK_LABELS: Record<string, { label: string; color: string }> = {
  joy: { label: '喜び', color: '#FFD700' },
  trust: { label: '信頼', color: '#98FB98' },
  fear: { label: '不安', color: '#228B22' },
  surprise: { label: '驚き', color: '#00CED1' },
  sadness: { label: '悲しみ', color: '#4169E1' },
  disgust: { label: '嫌悪', color: '#9370DB' },
  anger: { label: '怒り', color: '#FF4500' },
  anticipation: { label: '期待', color: '#FFA500' },
}

interface EmotionBadge { key: string; label: string; color: string; value: number }

function formatEventTime(iso: string): string {
  if (!iso.includes('T')) return '終日'
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tokyo' })
}

/* ── Helpers ── */

function formatDueDate(dueDate: string | null, todayStr: string): { label: string; color: string; bg: string; border: string } | null {
  if (!dueDate) return null
  if (dueDate < todayStr) {
    const days = Math.floor((new Date(todayStr).getTime() - new Date(dueDate).getTime()) / 86400000)
    return { label: `${days}日超過`, color: 'var(--red)', bg: 'var(--red-bg)', border: 'var(--red-border)' }
  }
  if (dueDate === todayStr) return { label: '今日', color: 'var(--red)', bg: 'var(--red-bg)', border: 'var(--red-border)' }
  const tomorrow = new Date(todayStr)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
  if (dueDate === tomorrowStr) return { label: '明日', color: 'var(--amber)', bg: 'var(--amber-bg)', border: 'var(--amber-border)' }
  // Show MM/DD
  const [, m, d] = dueDate.split('-')
  return { label: `${parseInt(m)}/${parseInt(d)}`, color: 'var(--text3)', bg: 'var(--surface2)', border: 'var(--border)' }
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div style={{ width: 40, height: 3, borderRadius: 2, background: 'var(--surface2)', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{
        width: `${Math.max(0, Math.min(100, pct))}%`,
        height: '100%',
        background: pct >= 100 ? 'var(--green)' : 'var(--accent)',
        transition: 'width .2s',
      }} />
    </div>
  )
}

function TaskRow({ task: t, todayStr, done, onToggle, onUpdate }: {
  task: { id: string; title: string; due_date: string | null; priority: string; status: string; progress_pct?: number | null; deadline_at?: string | null }
  todayStr: string
  done: boolean
  onToggle: () => void
  onUpdate: (id: string, data: Record<string, unknown>) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(t.title)
  const [editDue, setEditDue] = useState(t.due_date || '')
  const [editPriority, setEditPriority] = useState(t.priority)
  const [editProgress, setEditProgress] = useState<string>(t.progress_pct != null ? String(t.progress_pct) : '')
  const due = formatDueDate(t.due_date, todayStr)

  const save = () => {
    const updates: Record<string, unknown> = {}
    if (editTitle.trim() && editTitle.trim() !== t.title) updates.title = editTitle.trim()
    if (editDue !== (t.due_date || '')) updates.due_date = editDue || null
    if (editPriority !== t.priority) updates.priority = editPriority
    const nextPct = editProgress === '' ? null : Math.max(0, Math.min(100, parseInt(editProgress, 10)))
    if (nextPct !== (t.progress_pct ?? null)) updates.progress_pct = nextPct
    if (Object.keys(updates).length > 0) onUpdate(t.id, updates)
    setEditing(false)
  }

  if (editing) {
    return (
      <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <input
            className="input"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
            autoFocus
            style={{ flex: 1, fontSize: 13, padding: '5px 8px' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="date"
            value={editDue}
            onChange={(e) => setEditDue(e.target.value)}
            style={{ fontSize: 11, padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 4, fontFamily: 'var(--mono)', background: 'var(--surface)', color: 'var(--text2)' }}
          />
          <select
            value={editPriority}
            onChange={(e) => setEditPriority(e.target.value)}
            style={{ fontSize: 11, padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text2)' }}
          >
            <option value="low">低</option>
            <option value="normal">通常</option>
            <option value="high">高</option>
          </select>
          <label style={{ fontSize: 10, color: 'var(--text3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            進捗
            <input
              type="number"
              min={0}
              max={100}
              placeholder="-"
              value={editProgress}
              onChange={(e) => setEditProgress(e.target.value)}
              style={{ width: 48, fontSize: 11, padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 4, fontFamily: 'var(--mono)', background: 'var(--surface)', color: 'var(--text2)' }}
            />
            <span style={{ fontFamily: 'var(--mono)' }}>%</span>
          </label>
          <div style={{ flex: 1, minWidth: 0 }} />
          <button className="btn btn-g btn-sm" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => setEditing(false)}>Cancel</button>
          <button className="btn btn-p btn-sm" style={{ fontSize: 11, padding: '3px 8px' }} onClick={save}>Save</button>
        </div>
      </div>
    )
  }

  const hasProgress = t.progress_pct != null && !done
  return (
    <div style={{ padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, opacity: done ? 0.55 : 1 }}>
      <span
        onClick={onToggle}
        style={{
          width: 18, height: 18, borderRadius: 4, flexShrink: 0, cursor: 'pointer',
          border: `2px solid ${done ? 'var(--green)' : 'var(--border)'}`,
          background: done ? 'var(--green)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, color: '#fff', transition: 'all .15s',
        }}
        onMouseEnter={(e) => { if (!done) { e.currentTarget.style.borderColor = 'var(--green)'; e.currentTarget.style.background = 'var(--green-bg)' } }}
        onMouseLeave={(e) => { if (!done) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'transparent' } }}
      >
        {done ? '✓' : ''}
      </span>
      <span
        onClick={() => { if (!done) { setEditTitle(t.title); setEditDue(t.due_date || ''); setEditPriority(t.priority); setEditProgress(t.progress_pct != null ? String(t.progress_pct) : ''); setEditing(true) } }}
        style={{ flex: 1, fontWeight: 500, textDecoration: done ? 'line-through' : 'none', color: done ? 'var(--text3)' : 'var(--text)', cursor: done ? 'default' : 'pointer' }}
      >
        {t.title}
      </span>
      {hasProgress && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <ProgressBar pct={t.progress_pct ?? 0} />
          <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', minWidth: 26, textAlign: 'right' }}>{t.progress_pct}%</span>
        </span>
      )}
      {due && (
        <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 3, color: due.color, background: due.bg, border: `1px solid ${due.border}`, fontFamily: 'var(--mono)' }}>
          {due.label}
        </span>
      )}
      {t.priority === 'high' && (
        <span style={{ fontSize: 9, color: 'var(--amber)', fontWeight: 600, padding: '1px 5px', background: 'var(--amber-bg)', borderRadius: 3, border: '1px solid var(--amber-border)' }}>高</span>
      )}
    </div>
  )
}

/* ── Page ── */

export function Today() {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [streak, setStreak] = useState(0)
  const [pendingImages, setPendingImages] = useState<File[]>([])
  const [pendingImagePreviews, setPendingImagePreviews] = useState<string[]>([])
  const [uploadingImages, setUploadingImages] = useState(false)
  const [emotionBadges, setEmotionBadges] = useState<Map<string, EmotionBadge[]>>(new Map())
  const { analyze, analyzing, error: emotionError } = useEmotionAnalysis()
  const { detect: detectMoment } = useMomentDetector()
  const { extract: extractFromDiary } = useDiaryExtraction()
  const weather = useTodayWeather()
  const [lastExtraction, setLastExtraction] = useState<DiaryExtractionResult | null>(null)
  const [extractionDismissed, setExtractionDismissed] = useState(false)

  const timeMode: TimeMode = useMemo(() => getTimeMode(), [])

  const {
    diaryEntries, tasks, dreams, habits, habitLogs,
    fetchDiary, fetchTasks, fetchDreams, fetchHabits, fetchHabitLogs, fetchEmotions,
    addDiaryEntry, toggleHabitLog,
    updateTask, addHabit,
  } = useDataStore()

  // Inline add states (Habits のみ — Tasks 追加は /calendar に集約)
  const [newHabitTitle, setNewHabitTitle] = useState('')
  const [showAddHabit, setShowAddHabit] = useState(false)

  const todayStr = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

  useEffect(() => {
    fetchDiary({ days: 1 })
    fetchEmotions({ days: 1 })
    fetchTasks()
    fetchDreams()
    fetchHabits()
    fetchHabitLogs()
    calculateStreak().then(setStreak)
  }, [fetchDiary, fetchEmotions, fetchTasks, fetchDreams, fetchHabits, fetchHabitLogs])

  // Keyboard shortcut listeners
  useEffect(() => {
    const onAddTask = () => navigate('/calendar')
    const onFocusDiary = () => {
      const textarea = document.querySelector<HTMLTextAreaElement>('textarea[placeholder]')
      textarea?.focus()
    }
    window.addEventListener('shortcut:add-task', onAddTask)
    window.addEventListener('shortcut:focus-diary', onFocusDiary)
    return () => {
      window.removeEventListener('shortcut:add-task', onAddTask)
      window.removeEventListener('shortcut:focus-diary', onFocusDiary)
    }
  }, [])

  /* ── Computed data ── */

  const fragments = useMemo(() => diaryEntries.filter((e) => e.created_at.substring(0, 10) === todayStr), [diaryEntries, todayStr])

  // Tasks: today's actionable items (requests are excluded — they live in the Tasks page)
  const allOpenTasks = useMemo(() => tasks.filter((t) => (t.status === 'open' || t.status === 'in_progress') && t.type !== 'request'), [tasks])
  const completedToday = useMemo(() => tasks.filter((t) => t.status === 'done' && t.type !== 'request' && t.completed_at?.substring(0, 10) === todayStr), [tasks, todayStr])

  // ── Deadline aggregator ──
  // A task "has a deadline" when either deadline_at or due_date is set.
  // Classification uses the earliest of the two (deadline_at wins when both exist).
  const deadlineBuckets = useMemo(() => {
    const tomorrow = new Date(todayStr + 'T00:00:00')
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
    const weekEnd = new Date(todayStr + 'T00:00:00')
    weekEnd.setDate(weekEnd.getDate() + 7)
    const weekEndStr = `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, '0')}-${String(weekEnd.getDate()).padStart(2, '0')}`

    const overdue: typeof allOpenTasks = []
    const dueToday: typeof allOpenTasks = []
    const dueTomorrow: typeof allOpenTasks = []
    const dueThisWeek: typeof allOpenTasks = []

    for (const t of allOpenTasks) {
      const deadlineDate = t.deadline_at ? t.deadline_at.substring(0, 10) : t.due_date
      if (!deadlineDate) continue
      if (deadlineDate < todayStr) overdue.push(t)
      else if (deadlineDate === todayStr) dueToday.push(t)
      else if (deadlineDate === tomorrowStr) dueTomorrow.push(t)
      else if (deadlineDate <= weekEndStr) dueThisWeek.push(t)
    }

    const byDeadline = (a: typeof allOpenTasks[number], b: typeof allOpenTasks[number]) => {
      const ad = a.deadline_at || (a.due_date ? a.due_date + 'T23:59:59' : '9999')
      const bd = b.deadline_at || (b.due_date ? b.due_date + 'T23:59:59' : '9999')
      return ad.localeCompare(bd)
    }
    overdue.sort(byDeadline)
    dueToday.sort(byDeadline)
    dueTomorrow.sort(byDeadline)
    dueThisWeek.sort(byDeadline)
    return { overdue, dueToday, dueTomorrow, dueThisWeek }
  }, [allOpenTasks, todayStr])

  const hasDeadlineAlert = deadlineBuckets.overdue.length + deadlineBuckets.dueToday.length + deadlineBuckets.dueTomorrow.length + deadlineBuckets.dueThisWeek.length > 0

  // Timeline: merges calendar events + time-bound tasks into 30-min slots
  const timeline = useTodayTimeline(allOpenTasks, completedToday)
  const { slots: timelineSlots, todayTasks: timelineTodayTasks, upcomingTasks, todayCalEvents, tomorrowEvents, recentEventName, loading: timelineLoading, calendarAuthenticated } = timeline

  const priorityWeight = { high: 0, normal: 1, low: 2 } as const

  // todayTasks = tasks from timeline (no specific time, due today/overdue/high priority)
  const todayTasks = useMemo(() => {
    return [...timelineTodayTasks].sort((a, b) => {
      const aDate = a.due_date || '9999-99-99'
      const bDate = b.due_date || '9999-99-99'
      if (aDate !== bDate) return aDate < bDate ? -1 : 1
      return (priorityWeight[a.priority] ?? 1) - (priorityWeight[b.priority] ?? 1)
    })
  }, [timelineTodayTasks])

  // otherOpenTasks = backlog (not in timeline or todayTasks)
  const otherOpenTasks = useMemo(() => {
    const timelineTaskIds = new Set<string>()
    for (const slot of timelineSlots) {
      for (const item of slot.items) {
        if (item.type === 'task') timelineTaskIds.add(item.id)
      }
    }
    const todayIds = new Set(todayTasks.map((t) => t.id))
    const upcomingIds = new Set(upcomingTasks.map((t) => t.id))
    return allOpenTasks.filter((t) => !timelineTaskIds.has(t.id) && !todayIds.has(t.id) && !upcomingIds.has(t.id))
      .sort((a, b) => {
        const aDate = a.due_date || '9999-99-99'
        const bDate = b.due_date || '9999-99-99'
        if (aDate !== bDate) return aDate < bDate ? -1 : 1
        return (priorityWeight[a.priority] ?? 1) - (priorityWeight[b.priority] ?? 1)
      })
  }, [allOpenTasks, timelineSlots, todayTasks, upcomingTasks])

  // Habits
  /** Get the Monday of the current week as YYYY-MM-DD (ISO week: Mon-Sun) */
  const weekStartStr = useMemo(() => {
    const d = new Date(todayStr + 'T00:00:00')
    const day = d.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
    const diff = day === 0 ? -6 : 1 - day // shift back to Monday
    d.setDate(d.getDate() + diff)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [todayStr])

  const monthStartStr = useMemo(() => todayStr.substring(0, 8) + '01', [todayStr])

  const todayHabits = useMemo(() => {
    return habits.map((habit) => {
      const todayCount = habitLogs.filter((l) => l.habit_id === habit.id && l.completed_at.substring(0, 10) === todayStr).length
      const doneToday = todayCount > 0
      if (habit.frequency === 'weekly') {
        const periodCount = habitLogs.filter(
          (l) => l.habit_id === habit.id && l.completed_at.substring(0, 10) >= weekStartStr && l.completed_at.substring(0, 10) <= todayStr,
        ).length
        return { ...habit, todayCount, periodCount, completed: periodCount >= habit.target_count, doneToday }
      }
      if (habit.frequency === 'monthly') {
        const periodCount = habitLogs.filter(
          (l) => l.habit_id === habit.id && l.completed_at.substring(0, 10) >= monthStartStr && l.completed_at.substring(0, 10) <= todayStr,
        ).length
        return { ...habit, todayCount, periodCount, completed: periodCount >= habit.target_count, doneToday }
      }
      return { ...habit, todayCount, periodCount: todayCount, completed: todayCount >= habit.target_count, doneToday }
    })
  }, [habits, habitLogs, todayStr, weekStartStr, monthStartStr])
  // Habits progress — only count daily habits for all-done check
  const dailyHabits = todayHabits.filter((h) => h.frequency === 'daily')
  const dailyHabitsCompleted = dailyHabits.filter((h) => h.completed).length
  const habitsAllDone = dailyHabits.length > 0 && dailyHabitsCompleted === dailyHabits.length

  // Dreams
  const dreamsCount = useMemo(() => dreams.filter((d) => d.status === 'active' || d.status === 'in_progress').length, [dreams])

  // WBI
  const wbi = useMemo(() => { const e = diaryEntries.find((e) => e.wbi != null); return e?.wbi ?? null }, [diaryEntries])

  // Emotion badges
  const emotionAnalyses = useDataStore((s) => s.emotionAnalyses)
  useEffect(() => {
    if (fragments.length === 0) return
    const entryIds = new Set(fragments.map((e) => e.id))
    const badgeMap = new Map<string, EmotionBadge[]>()
    for (const ea of emotionAnalyses) {
      if (!entryIds.has(ea.diary_entry_id)) continue
      const scores = Object.entries(PLUTCHIK_LABELS).map(([key, info]) => ({
        key, label: info.label, color: info.color,
        value: (ea as unknown as Record<string, number>)[key] ?? 0,
      }))
      scores.sort((a, b) => b.value - a.value)
      badgeMap.set(ea.diary_entry_id, scores.filter((s) => s.value > 20).slice(0, 2))
    }
    setEmotionBadges(badgeMap)
  }, [fragments, emotionAnalyses])

  /* ── Save diary ── */


  const handleImageSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return
    const valid: File[] = []
    const previews: string[] = []
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue
      if (f.size > 10 * 1024 * 1024) {
        toast(`${f.name}: 10MB超のためスキップ`)
        continue
      }
      valid.push(f)
      previews.push(URL.createObjectURL(f))
    }
    setPendingImages((prev) => [...prev, ...valid])
    setPendingImagePreviews((prev) => [...prev, ...previews])
  }, [])

  const removePendingImage = useCallback((idx: number) => {
    setPendingImagePreviews((prev) => {
      const toRevoke = prev[idx]
      if (toRevoke) URL.revokeObjectURL(toRevoke)
      return prev.filter((_, i) => i !== idx)
    })
    setPendingImages((prev) => prev.filter((_, i) => i !== idx))
  }, [])

  const saveEntry = useCallback(async (content: string) => {
    if (!content.trim() && pendingImages.length === 0) return
    setSaving(true)

    // Upload images first (if any) so we can store their paths with the entry
    let imagePaths: string[] | undefined
    if (pendingImages.length > 0) {
      setUploadingImages(true)
      try {
        const results = await Promise.all(
          pendingImages.map((file, idx) => uploadDiaryImage(file, idx)),
        )
        imagePaths = results.filter((p: unknown): p is string => typeof p === 'string')
      } catch (err) {
        toast(err instanceof Error ? err.message : '画像アップロードに失敗しました')
        setSaving(false)
        setUploadingImages(false)
        return
      }
      setUploadingImages(false)
    }

    const inserted = await addDiaryEntry({
      body: content.trim() || '(画像のみ)',
      entry_type: 'fragment',
      entry_date: todayStr,
      image_urls: imagePaths,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setText('')
    // Clear pending images + revoke object URLs
    pendingImagePreviews.forEach((u) => URL.revokeObjectURL(u))
    setPendingImages([])
    setPendingImagePreviews([])
    if (inserted?.id) {
      const result = await analyze(inserted.id, content.trim())
      if (result) {
        const scores = Object.entries(PLUTCHIK_LABELS).map(([key, info]) => ({
          key, label: info.label, color: info.color, value: result.plutchik[key] ?? 0,
        }))
        scores.sort((a, b) => b.value - a.value)
        setEmotionBadges((prev) => { const next = new Map(prev); next.set(inserted.id, scores.filter((s) => s.value > 20).slice(0, 2)); return next })
      }
      detectMoment(typeof inserted.id === 'number' ? inserted.id : parseInt(inserted.id, 10), content.trim()).then((r) => { if (r.detected && r.moment) toast(`転機を検出: ${r.moment.title}`) })
      // Persist embedding (fire-and-forget; 過去の自分カード検索用)
      const numericId = typeof inserted.id === 'number' ? inserted.id : parseInt(inserted.id, 10)
      if (!Number.isNaN(numericId)) {
        supabase.functions.invoke('diary-embed', { body: { id: numericId, text: content.trim() } })
          .catch((err) => console.error('[Today] diary-embed failed', err))
      }
      // Auto-extract tasks/habits from diary. High-confidence done items auto-check,
      // suggestions show up in the detection card for user confirmation.
      extractFromDiary(content.trim()).then(async (extraction) => {
        if (!extraction) return
        const nowIso = new Date().toISOString()
        const highDoneTasks = extraction.done_tasks.filter((d) => d.confidence === 'high')
        const highDoneHabits = extraction.done_habits.filter((d) => d.confidence === 'high')

        await Promise.all([
          ...highDoneTasks.map((t) =>
            supabase.from('tasks')
              .update({ status: 'done', completed_at: nowIso, source: 'auto:diary-extract' })
              .eq('id', t.task_id)
              .eq('status', 'open')
          ),
          ...highDoneHabits.map(async (h) => {
            const alreadyLogged = habitLogs.some((l) =>
              l.habit_id === h.habit_id && l.completed_at.substring(0, 10) === todayStr
            )
            if (alreadyLogged) return
            await supabase.from('habit_logs').insert({
              habit_id: h.habit_id,
              completed_at: nowIso,
              note: '[auto] 日記から検出',
            })
          }),
        ])

        if (highDoneTasks.length > 0 || highDoneHabits.length > 0) {
          await Promise.all([fetchTasks(), fetchHabitLogs()])
        }

        const hasAnything =
          extraction.done_tasks.length > 0 ||
          extraction.new_tasks.length > 0 ||
          extraction.done_habits.length > 0 ||
          extraction.new_habit_suggestions.length > 0
        if (hasAnything) {
          setLastExtraction(extraction)
          setExtractionDismissed(false)
        }
      }).catch((err) => console.error('[Today] diary extraction failed', err))
    }
  }, [addDiaryEntry, analyze, detectMoment, todayStr, pendingImages, pendingImagePreviews, extractFromDiary, habitLogs, fetchTasks, fetchHabitLogs])

  const diaryPrompt = useMemo(() => getDiaryPrompt(timeMode, recentEventName ?? undefined), [timeMode, recentEventName])
  // 「過去の自分カード」— 今書いている内容と意味が近い 14日より前の日記を返す
  const { entries: similarPast } = useSimilarPastEntry(text)
  const todayQuestions = useMemo(() => getTodayQuestions(todayStr), [todayStr])

  // News state — must be before any conditional return to satisfy Rules of Hooks
  const [newsItems, setNewsItems] = useState<Array<{ id?: string; title: string; title_ja?: string | null; summary: string; url: string | null; source: string; source_type?: string | null; topic: string; published_date?: string | null }>>([])
  const [newsCollecting, setNewsCollecting] = useState(false)
  useEffect(() => {
    import('@/lib/newsCollect').then(({ loadNews, recordImpressions }) =>
      loadNews().then((items) => {
        if (items.length) {
          setNewsItems(items)
          // Record impressions for displayed items (async, non-blocking)
          const ids = items.filter((n) => n.id).map((n) => n.id!)
          recordImpressions(ids)
        }
      }).catch((e) => {
        console.error('[Today] news load error:', e)
      })
    ).catch((e) => {
      console.error('[Today] news module import error:', e)
    })
  }, [])

  /* ════════════════════════════════════════════
     SECTION BUILDERS
     ════════════════════════════════════════════ */

  /* ── [0] Greeting ── */

  // ユーザー名 (Greeting に「〜さん」と添える)
  const userMeta = useAuthStore.getState().user?.user_metadata
  const userName = (userMeta?.full_name || userMeta?.user_name || userMeta?.name) as string | undefined
  const displayName = userName ? userName.split(' ')[0].split('@')[0] : null

  const Greeting = (
    <div style={{ marginBottom: 18 }}>
      {/* spec: .heading は 32px / weight 300 / accent 強調 */}
      <h1 className="heading">
        {getGreeting(timeMode)}
        {displayName && <>、<strong>{displayName}さん。</strong></>}
      </h1>
      <div className="date-line">
        {formatToday()}
        {weather && <span className="weather-chip">{weather.today.icon} {weather.today.tempMax}℃ / {weather.today.tempMin}℃</span>}
      </div>
      {weather && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>明日: {weather.tomorrow.icon} {weather.tomorrow.tempMax}℃ / {weather.tomorrow.tempMin}℃</div>}
    </div>
  )

  /* ── [1] Today's Habits ── */

  // spec: Life 列の Habits セクション — .ls + .h-item でコンパクトに
  const HabitsSection = (
    <div className="ls">
      <div className="ls-title-row">
        <span className="ls-title">{habitsAllDone ? 'Habits — All done!' : 'Habits'}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {dailyHabits.length > 0 && (
            <span className="ls-progress">{dailyHabitsCompleted} / {dailyHabits.length}</span>
          )}
          <span className="ls-link" onClick={() => setShowAddHabit((v) => !v)}>＋</span>
          <span className="ls-link" onClick={() => navigate('/habits')}>詳細 →</span>
        </div>
      </div>

      {/* spec: 進捗 pip バー */}
      {dailyHabits.length > 0 && (
        <div className="habits-bar">
          {dailyHabits.map((h) => (
            <div key={h.id} className={`habit-pip${h.doneToday ? ' done' : ''}`} />
          ))}
        </div>
      )}

      {/* Inline add habit (+ で開く) */}
      {showAddHabit && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <input
            className="input"
            placeholder="新しい習慣..."
            value={newHabitTitle}
            onChange={(e) => setNewHabitTitle(e.target.value)}
            autoFocus
            style={{ flex: 1, fontSize: 12, padding: '5px 8px' }}
          />
          <button
            className="btn btn-p"
            style={{ fontSize: 11, padding: '5px 10px' }}
            disabled={!newHabitTitle.trim()}
            onClick={() => {
              if (newHabitTitle.trim()) {
                addHabit({ title: newHabitTitle.trim() })
                setNewHabitTitle('')
                setShowAddHabit(false)
                toast('習慣を追加しました')
              }
            }}
          >追加</button>
        </div>
      )}

      {/* 各習慣行: spec の .h-item */}
      {(timeMode === 'morning' ? todayHabits : [...todayHabits].sort((a, b) => Number(a.completed) - Number(b.completed))).map((h) => (
        <div key={h.id} className="h-item" style={{ cursor: 'pointer' }} onClick={() => toggleHabitLog(h, todayStr)}>
          <div className={`h-ck${h.doneToday ? ' done' : ''}`}>{h.doneToday ? '✓' : ''}</div>
          <div className={`h-name${h.doneToday ? ' done' : ''}`}>
            {h.icon} {h.title}
          </div>
          {/* 期間バッジ: weekly/monthly のみ。daily は省略してシンプルに */}
          {h.frequency !== 'daily' && (
            <div className="h-st" style={{ color: h.completed ? 'var(--accent)' : 'var(--text3)' }}>
              {h.periodCount}/{h.target_count}
            </div>
          )}
          {h.frequency === 'daily' && (
            h.doneToday ? <div className="h-st">✓</div> : <div className="h-st" style={{ color: 'var(--text3)' }}>—</div>
          )}
        </div>
      ))}
      {todayHabits.length === 0 && !showAddHabit && (
        <div style={{ padding: '6px 0', fontSize: 11, color: 'var(--text3)' }}>習慣なし — ＋ で追加</div>
      )}
    </div>
  )

  /* ── [2] Timeline — Life 列の Schedule (e-item) ── */

  // spec: Life 列の Schedule — .ls + .e-item でコンパクト表示。詳細は /calendar へ
  const TimelineSection = (
    <div className="ls">
      <div className="ls-title-row">
        <span className="ls-title">Schedule</span>
        <span className="ls-link" onClick={() => navigate('/calendar')}>カレンダー →</span>
      </div>
      {timelineLoading ? (
        <div style={{ fontSize: 11, color: 'var(--text3)', padding: '4px 0' }}>読み込み中…</div>
      ) : todayCalEvents.length === 0 && timelineTodayTasks.length === 0 ? (
        calendarAuthenticated === false ? (
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, lineHeight: 1.55 }}>
              Google Calendar と連携すると今日の予定が表示されます
            </div>
            <button className="btn btn-p" style={{ fontSize: 11, padding: '5px 10px' }} onClick={startCalendarAuth}>
              Sign in with Google
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--text3)', padding: '4px 0' }}>今日は予定なし</div>
        )
      ) : (
        <>
          {/* spec の .e-item: 時刻 + dot + タイトル */}
          {todayCalEvents.slice(0, 5).map((e) => {
            const time = formatEventTime(e.startTime)
            return (
              <div key={e.id} className="e-item" style={{ opacity: e.isPast ? 0.45 : 1 }}>
                <span className="e-time" style={{ color: e.isPast ? 'var(--text3)' : 'var(--text2)' }}>{time}</span>
                <span className="e-dot" style={{ background: e.isPast ? 'var(--text3)' : 'var(--accent)' }} />
                <span className="e-name" style={{ textDecoration: e.isPast ? 'line-through' : 'none' }}>{e.title}</span>
              </div>
            )
          })}
          {todayCalEvents.length > 5 && (
            <div style={{ fontSize: 10, color: 'var(--text3)', padding: '5px 0 0', fontFamily: 'var(--mono)' }}>他 {todayCalEvents.length - 5}件</div>
          )}
          {/* 時間未定タスク (Backlog 補完) */}
          {timelineTodayTasks.length > 0 && (
            <div style={{ fontSize: 10, color: 'var(--text3)', padding: '8px 0 4px', fontFamily: 'var(--mono)', borderTop: '1px dashed var(--border)', marginTop: 6 }}>
              時間未定 {timelineTodayTasks.length}件 — Tasks 参照
            </div>
          )}
        </>
      )}

    </div>
  )

  // Tomorrow events are now merged into the main Timeline card's 近日 section.
  // This block only renders when tomorrow is empty in evening mode (shows "明日はフリー" or Sign-in prompt).
  const Tomorrow = tomorrowEvents.length > 0 ? null : timeMode === 'evening' ? (
    <div className="section">
      <div className="section-title">明日の予定</div>
      <Card>
        {calendarAuthenticated === false ? (
          <div style={{ fontSize: 12, color: 'var(--text3)', padding: 4 }}>
            Google Calendar 未連携 — <span style={{ color: 'var(--accent)', textDecoration: 'underline', cursor: 'pointer' }} onClick={startCalendarAuth}>Sign in</span>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text3)', padding: 4 }}>明日はフリーです</div>
        )}
      </Card>
    </div>
  ) : null

  /* ── [3-2] FutureYouChat — Diary 後の「未来の自分」導線 ── */
  // AI Partner の受動コメント (briefingMessage) は社長判断で常時非表示
  // (型A 観察コメントが侮辱的に響くケースが続いたため)

  const FutureYouSection = (
    <FutureYouChat entryPoint="today_partner" />
  )

  /* ── [News] ── */

  async function handleCollectNews() {
    setNewsCollecting(true)
    try {
      const { collectNews } = await import('@/lib/newsCollect')
      const { count, items } = await collectNews()
      if (count > 0) {
        toast(count + '件のニュースを収集しました')
        setNewsItems(items)
      } else {
        toast('ニュースを取得できませんでした')
      }
    } catch (e) {
      console.error('News collect error:', e)
      toast('ニュース収集に失敗しました')
    }
    setNewsCollecting(false)
  }

  // spec: Life 列の News — .ls + 軽量リスト。Life 幅 320px に収める
  const NewsSection = (
    <div className="ls">
      <div className="ls-title-row">
        <span className="ls-title">News</span>
        <span className="ls-link" onClick={() => navigate('/news')}>すべて →</span>
      </div>
      {newsItems.length === 0 ? (
        <div style={{ fontSize: 11, color: 'var(--text3)', padding: '4px 0' }}>ニュースはまだありません</div>
      ) : (
        newsItems.slice(0, 4).map((n) => (
          <div key={n.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0, marginTop: 6,
                background: n.source_type === 'arxiv' ? '#b91c1c' : n.source_type === 'hackernews' ? '#ea580c' : n.source_type === 'rss_feed' ? 'var(--green)' : 'var(--accent)',
              }} />
              {n.url ? (
                <a href={n.url} target="_blank" rel="noopener noreferrer"
                  style={{ fontWeight: 500, color: 'var(--text)', textDecoration: 'none', lineHeight: 1.45, flex: 1 }}
                  onClick={() => { if (n.id) import('@/lib/newsCollect').then(({ recordClick }) => recordClick(n.id!)) }}
                >{n.title_ja || n.title}</a>
              ) : (
                <span style={{ fontWeight: 500, flex: 1 }}>{n.title_ja || n.title}</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4, marginLeft: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              {n.published_date && <span style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{n.published_date.substring(5)}</span>}
              {n.source && <span style={{ fontSize: 9, color: 'var(--text3)' }}>{n.source}</span>}
            </div>
          </div>
        ))
      )}
      {newsItems.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 10 }}>
          <span className="ls-link" onClick={handleCollectNews}>
            {newsCollecting ? '収集中…' : '🔄 最新を取得'}
          </span>
        </div>
      )}
    </div>
  )

  /* ── [4] Diary ── */

  const Diary = (
    <div style={{ marginBottom: 16 }}>
      {/* spec: .prompt-text — 斜体 + accent 縦線で「今日の問い」を独立表示 */}
      <p className="prompt-text">「{diaryPrompt}」</p>
      <Card>
      <textarea
        className="input"
        placeholder="思ったままに書いてみましょう。"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && (text.trim() || pendingImages.length > 0) && !saving && !analyzing) { e.preventDefault(); saveEntry(text) } }}
        style={{ minHeight: timeMode === 'evening' ? 120 : 140, width: '100%', boxSizing: 'border-box', marginBottom: 8 }}
      />
      {/* Similar past entry — live suggestion while typing */}
      {text.trim().length >= 8 && similarPast.length > 0 && (
        <div
          onClick={() => navigate(`/journal#entry-${similarPast[0].id}`)}
          style={{
            margin: '4px 0 10px', padding: '10px 14px',
            background: 'var(--accent-bg)',
            border: '1px dashed var(--accent-border)',
            borderRadius: 'var(--r)',
            display: 'flex', alignItems: 'flex-start', gap: 10,
            cursor: 'pointer', fontSize: 12,
          }}
          title="タップで開く"
        >
          <span style={{ color: 'var(--accent)', fontSize: 13, flexShrink: 0, marginTop: 2 }}>✦</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: 'var(--accent)',
              textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 3,
            }}>
              書きながら浮かんできた、似ている過去の記録
            </div>
            <div style={{ color: 'var(--text2)', lineHeight: 1.55, fontSize: 12 }}>
              {new Date(similarPast[0].entry_date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}{' '}— {similarPast[0].body.slice(0, 60)}{similarPast[0].body.length > 60 ? '…' : ''}
            </div>
          </div>
        </div>
      )}
      {pendingImagePreviews.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          {pendingImagePreviews.map((src, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <img src={src} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
              <button
                onClick={() => removePendingImage(i)}
                aria-label="画像を削除"
                style={{
                  position: 'absolute', top: -6, right: -6, width: 20, height: 20,
                  borderRadius: '50%', background: 'var(--text)', color: 'var(--bg)',
                  border: 'none', cursor: 'pointer', fontSize: 11, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1,
                }}
              >×</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px',
              fontSize: 12, color: 'var(--text2)', cursor: 'pointer', borderRadius: 6,
              border: '1px solid var(--border)', background: 'transparent',
              whiteSpace: 'nowrap', lineHeight: 1.2, fontWeight: 500,
            }}
            title="写真を添付"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <rect x="2" y="4" width="12" height="9" rx="1.2"/>
              <circle cx="8" cy="8.5" r="2.2"/>
              <path d="M5.5 4 L6.5 2.5 L9.5 2.5 L10.5 4"/>
            </svg>
            写真
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => { handleImageSelect(e.target.files); e.target.value = '' }}
              style={{ display: 'none' }}
            />
          </label>
          <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
            {saving ? (uploadingImages ? '画像アップロード中…' : '保存中…') : saved ? '保存しました ✓' : analyzing ? '感情分析中…' : text.trim() ? `${text.trim().length}文字 · 自動保存済み ✓` : ''}
          </span>
        </div>
        <button
          className="btn btn-p"
          onClick={() => saveEntry(text)}
          disabled={(!text.trim() && pendingImages.length === 0) || saving || analyzing}
          style={{ padding: '7px 16px', fontSize: 13, whiteSpace: 'nowrap', minHeight: 36 }}
        >
          {analyzing ? '分析中…' : '保存'}
        </button>
      </div>
      {emotionError && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{emotionError}</div>}
      {lastExtraction && !extractionDismissed && (
        <DiaryExtractionResultCard
          result={lastExtraction}
          onDismiss={() => setExtractionDismissed(true)}
          onChanged={() => { fetchTasks(); fetchHabitLogs() }}
        />
      )}
      {/* Analysis questions - subtle prompts to improve self-analysis precision */}
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {todayQuestions.map((q, i) => (
          <div
            key={i}
            title={`${q.axis} / ${q.depth}`}
            onClick={() => setText((prev) => prev ? `${prev}\n${q.text} ` : `${q.text} `)}
            style={{
              fontSize: 11,
              color: 'var(--text3)',
              cursor: 'pointer',
              padding: '4px 0',
              lineHeight: 1.5,
              transition: 'color .15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)' }}
          >
            {q.text}
          </div>
        ))}
      </div>
      {/* 過去の自分カード — 忘れていた似た日記を1〜2件 */}
      {similarPast.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6, letterSpacing: 0.3 }}>
            ◇ 過去の自分 — 似たことを書いていた日
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {similarPast.map((p) => (
              <div
                key={p.id}
                style={{
                  fontSize: 11,
                  color: 'var(--text2)',
                  padding: '6px 8px',
                  background: 'var(--surface)',
                  borderRadius: 4,
                  borderLeft: '2px solid var(--accent)',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2, fontFamily: 'var(--mono)' }}>
                  {p.entry_date}
                </div>
                <div>{p.body.length > 120 ? p.body.substring(0, 120) + '…' : p.body}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      </Card>
    </div>
  )

  /* ── [5] Fragments ── */

  // spec: .past — 「今日の断片」を accent border-top でコンパクトに
  const Fragments = fragments.length > 0 ? (
    <div className="past">
      <div className="past-label">今日の断片</div>
      {fragments.map((f: DiaryEntry) => {
        const badges = emotionBadges.get(f.id) || []
        return (
          <div key={f.id} className="past-item">
            <div className="past-item-head">
              <span className="past-time">
                {new Date(f.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
              </span>
              {badges.map((b) => (
                <span key={b.key} className="emotion-badge" style={{ background: b.color, color: '#fff' }}>
                  {b.label} {b.value}
                </span>
              ))}
            </div>
            <div className="past-text">{f.body}</div>
            {f.image_urls && f.image_urls.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                {f.image_urls.map((path, i) => (
                  <DiaryImageThumb key={i} path={path} size={56} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  ) : null

  /* ── [6] Status bar (streak, dreams, WBI) ── */

  // spec: Life 列の冒頭 .life-head — Streak (左) と WBI (右) を baseline で対比
  const StatusBar = (streak > 0 || dreamsCount > 0 || wbi !== null) ? (
    <div className="life-head">
      <div className="life-vitals">
        <div className="streak-block">
          {streak > 0 ? (
            <>
              <span className="streak-n">{streak}</span>
              <span className="streak-u">日連続</span>
            </>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>記録を始めよう</span>
          )}
        </div>
        {wbi !== null && (
          <div className="wbi-block">
            <div className="wbi-label">WBI</div>
            <div className="wbi-row">
              <span className="wbi-score">{wbi.toFixed(1)}</span>
            </div>
          </div>
        )}
      </div>
      {dreamsCount > 0 && (
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text3)', cursor: 'pointer' }} onClick={() => navigate('/dreams')}>
          🌟 <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{dreamsCount}</span> 個の夢が進行中 →
        </div>
      )}
    </div>
  ) : null

  /* ── Deadlines section — overdue / today / tomorrow / this week ── */

  const DeadlinesSection = hasDeadlineAlert ? (
    <div style={{ marginBottom: 18 }}>
      {/* spec: .deadline-alert は赤バナー1行（バッジ+テキスト）。今日締切と遅延を強調 */}
      {deadlineBuckets.overdue.slice(0, 2).map((t) => (
        <div key={t.id} className="deadline-alert" style={{ cursor: 'pointer' }}
          onClick={() => { updateTask(t.id, { status: 'done', completed_at: new Date().toISOString() }); toast('完了!') }}>
          <span className="deadline-badge">遅延</span>
          <span className="deadline-text">{t.title}</span>
        </div>
      ))}
      {deadlineBuckets.dueToday.slice(0, 2).map((t) => (
        <div key={t.id} className="deadline-alert" style={{ cursor: 'pointer' }}
          onClick={() => { updateTask(t.id, { status: 'done', completed_at: new Date().toISOString() }); toast('完了!') }}>
          <span className="deadline-badge">今日締切</span>
          <span className="deadline-text">{t.title}</span>
        </div>
      ))}
      {/* 残り（明日・今週中）は控えめにサマリー1行で */}
      {(deadlineBuckets.dueTomorrow.length > 0 || deadlineBuckets.dueThisWeek.length > 0
        || deadlineBuckets.overdue.length > 2 || deadlineBuckets.dueToday.length > 2) && (
        <div style={{ fontSize: 11, color: 'var(--text3)', padding: '4px 14px', cursor: 'pointer' }}
          onClick={() => navigate('/calendar')}>
          {deadlineBuckets.overdue.length > 2 && <span style={{ color: 'var(--red)', marginRight: 8 }}>遅延 +{deadlineBuckets.overdue.length - 2}</span>}
          {deadlineBuckets.dueToday.length > 2 && <span style={{ color: 'var(--red)', marginRight: 8 }}>今日 +{deadlineBuckets.dueToday.length - 2}</span>}
          {deadlineBuckets.dueTomorrow.length > 0 && <span style={{ color: 'var(--amber)', marginRight: 8 }}>明日 {deadlineBuckets.dueTomorrow.length}</span>}
          {deadlineBuckets.dueThisWeek.length > 0 && <span>今週 {deadlineBuckets.dueThisWeek.length}</span>}
          <span style={{ marginLeft: 6, fontSize: 10 }}>→</span>
        </div>
      )}

      {/* legacy 詳細（折りたたみ）— 元の Card 表示は将来削除予定 */}
      {false && (
      <Card style={{ display: 'none' }}>
        {deadlineBuckets.overdue.length > 0 && (
          <>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--red)', marginTop: 2, marginBottom: 4 }}>
              遅延
            </div>
            {deadlineBuckets.overdue.map((t) => (
              <TaskRow key={t.id} task={t} todayStr={todayStr} done={false}
                onToggle={() => { updateTask(t.id, { status: 'done', completed_at: new Date().toISOString() }); toast('完了!') }}
                onUpdate={(id, data) => { updateTask(id, data); toast('更新しました') }} />
            ))}
          </>
        )}
        {deadlineBuckets.dueToday.length > 0 && (
          <>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--red)', marginTop: 10, marginBottom: 4 }}>
              今日
            </div>
            {deadlineBuckets.dueToday.map((t) => (
              <TaskRow key={t.id} task={t} todayStr={todayStr} done={false}
                onToggle={() => { updateTask(t.id, { status: 'done', completed_at: new Date().toISOString() }); toast('完了!') }}
                onUpdate={(id, data) => { updateTask(id, data); toast('更新しました') }} />
            ))}
          </>
        )}
        {deadlineBuckets.dueTomorrow.length > 0 && (
          <>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--amber)', marginTop: 10, marginBottom: 4 }}>
              明日
            </div>
            {deadlineBuckets.dueTomorrow.map((t) => (
              <TaskRow key={t.id} task={t} todayStr={todayStr} done={false}
                onToggle={() => { updateTask(t.id, { status: 'done', completed_at: new Date().toISOString() }); toast('完了!') }}
                onUpdate={(id, data) => { updateTask(id, data); toast('更新しました') }} />
            ))}
          </>
        )}
        {deadlineBuckets.dueThisWeek.length > 0 && (
          <>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text3)', marginTop: 10, marginBottom: 4 }}>
              今週中
            </div>
            {deadlineBuckets.dueThisWeek.slice(0, 5).map((t) => (
              <TaskRow key={t.id} task={t} todayStr={todayStr} done={false}
                onToggle={() => { updateTask(t.id, { status: 'done', completed_at: new Date().toISOString() }); toast('完了!') }}
                onUpdate={(id, data) => { updateTask(id, data); toast('更新しました') }} />
            ))}
            {deadlineBuckets.dueThisWeek.length > 5 && (
              <div style={{ padding: '5px 0 0', fontSize: 11, color: 'var(--text3)' }}>他 {deadlineBuckets.dueThisWeek.length - 5}件</div>
            )}
          </>
        )}
      </Card>
      )}
    </div>
  ) : null

  /* ── [7] Backlog (other open tasks, shown only if relevant) ── */

  // spec: Life 列の Tasks セクション — .ls + .t-item でコンパクトに
  const Backlog = otherOpenTasks.length > 0 ? (
    <div className="ls">
      <div className="ls-title-row">
        <span className="ls-title">Tasks</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="ls-progress">{otherOpenTasks.length}件</span>
          <span className="ls-link" onClick={() => navigate('/calendar')}>すべて →</span>
        </div>
      </div>
      {otherOpenTasks.slice(0, 4).map((t) => {
        const due = formatDueDate(t.due_date, todayStr)
        return (
          <div
            key={t.id}
            className="t-item"
            style={{ cursor: 'pointer' }}
            onClick={() => { updateTask(t.id, { status: 'done', completed_at: new Date().toISOString() }); toast('完了!') }}
          >
            <div className="t-sq" />
            <div className="t-name">{t.title}</div>
            {due && <span className={`t-due ${due.color === 'var(--red)' ? 'r' : due.color === 'var(--amber)' ? 'a' : 'n'}`}>{due.label}</span>}
          </div>
        )
      })}
      {otherOpenTasks.length > 4 && (
        <div style={{ fontSize: 10, color: 'var(--text3)', padding: '5px 0 0', fontFamily: 'var(--mono)' }}>他 {otherOpenTasks.length - 4}件</div>
      )}
    </div>
  ) : null

  /* ════════════════════════════════════════════
     UNIFIED LAYOUT — 3-layer structure:
       L1 やること (action required): diary, habits
       L2 緊急 (urgency): deadlines, calendar
       L3 有益 (informative): briefing, news, fragments
     ════════════════════════════════════════════ */

  return (
    <div className="page today-2col">
      {/* ════════ Writing 列 (左主) — design-spec.html の .writing 準拠 ════════ */}
      <div className="today-writing">
        {/* Story 更新通知 (Arc/Theme 更新時のみ。Life 列が見えないモバイルで特に重要) */}
        <StoryUpdateBanner />

        {/* 日付・天気・挨拶 */}
        {Greeting}

        {/* 前奏カード (proactive prelude) — 沈黙/詰まり/パターン再来を検知して
           前夜に生成された短い差し出し。シグナルが立たない日は表示されない。
           silence-first × proactive の最初の体験 (arXiv:2604.00842 Pare 4軸) */}
        <ProactivePreludeCard />

        {/* 朝の名言 (受動表示) */}
        <MorningQuoteCard />

        {/* 未処理の AI 提案 (Pending updates) */}
        <PendingUpdatesBanner />

        {/* 今日締切アラート — 書く前に「気にすべきこと」を脳にセット */}
        {DeadlinesSection}

        {/* 日記入力（プロンプト + textarea + similar-while-writing + save + extraction-detail） */}
        {Diary}

        {/* 未来の自分との対話 (FutureYouChat) — spec の future-you-card と同等の能動導線 */}
        {FutureYouSection}

        {/* 今日の断片 (past) — 書きためた今日のエントリ */}
        {Fragments}
      </div>

      {/* ════════ Life 列 (右副) — design-spec.html の .life 準拠 ════════ */}
      <div className="today-life">
        {/* WBI + Streak (life-head 相当) */}
        {StatusBar}

        {/* Habits 5件 + 進捗 */}
        {HabitsSection}

        {/* Schedule */}
        {TimelineSection}

        {/* Tomorrow preview (予定が無ければ表示) */}
        {Tomorrow}

        {/* Tasks (締切順) */}
        {Backlog}

        {/* キャプチャ (raw idea を溜める入口) */}
        <TodayIdeasCard />

        {/* News */}
        {NewsSection}
      </div>
    </div>
  )
}
