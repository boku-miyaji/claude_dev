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
import type { TimelineItem } from '@/hooks/useTodayTimeline'
import { toast } from '@/components/ui'
import { FutureYouChat } from '@/components/FutureYouChat'
import { useMorningBriefing } from '@/hooks/useMorningBriefing'
import { StoryUpdateBanner } from '@/components/StoryUpdateBanner'
import { MorningQuoteCard } from '@/components/MorningQuoteCard'
import { useDataStore } from '@/stores/data'
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
    addTask, updateTask, addHabit,
  } = useDataStore()

  // Inline add states
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [showAddTask, setShowAddTask] = useState(false)
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
    const onAddTask = () => setShowAddTask(true)
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
  const { slots: timelineSlots, todayTasks: timelineTodayTasks, completedUntimedToday, upcomingTasks, todayCalEvents, tomorrowEvents, recentEventName, loading: timelineLoading, calendarAuthenticated } = timeline

  // Build event text for AI Partner briefing (title + JST time)
  const todayEventsText = todayCalEvents.length > 0
    ? todayCalEvents.map((e) => {
        const time = e.startTime.includes('T')
          ? new Date(e.startTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tokyo' })
          : '終日'
        return `${time} ${e.title}`
      }).join('\n')
    : undefined
  const tomorrowEventsText = tomorrowEvents.length > 0
    ? tomorrowEvents.map((e) => e.title).join('、')
    : undefined
  const weatherText = weather ? `${weather.today.icon} ${weather.today.tempMax}℃` : undefined

  const { message: briefingMessage } = useMorningBriefing(
    timeMode,
    todayEventsText,
    tomorrowEventsText,
    weatherText,
    !timelineLoading,
  )


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
  const [translatingNewsId, setTranslatingNewsId] = useState<string | null>(null)

  const handleTranslateNews = async (id: string) => {
    setTranslatingNewsId(id)
    try {
      const { translateNewsItem } = await import('@/lib/newsCollect')
      const updated = await translateNewsItem(id)
      if (updated) {
        setNewsItems((prev) => prev.map((n) => (n.id === id ? { ...n, title_ja: updated.title_ja, summary: updated.summary } : n)))
      }
    } catch (e) {
      console.error('[Today] translate news error:', e)
    } finally {
      setTranslatingNewsId(null)
    }
  }

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

  // Timeline hooks — must be before any conditional return (Rules of Hooks)
  const nowMarkerTime = useMemo(() => {
    const d = new Date()
    return `${String(d.getHours()).padStart(2, '0')}:${d.getMinutes() < 30 ? '00' : '30'}`
  }, [])

  // Show all today's slots (past events stay visible but dimmed via item.isPast styling)
  const filteredSlots = timelineSlots


  /* ════════════════════════════════════════════
     SECTION BUILDERS
     ════════════════════════════════════════════ */

  /* ── [0] Greeting ── */

  const Greeting = (
    <div style={{ marginBottom: 20 }}>
      <div className="page-title" style={{ marginBottom: 4 }}>{getGreeting(timeMode)}</div>
      <div style={{ fontSize: 13, color: 'var(--text2)' }}>
        {formatToday()}
        {weather && <span style={{ marginLeft: 8 }}>{weather.today.icon} {weather.today.tempMax}℃ / {weather.today.tempMin}℃</span>}
      </div>
      {weather && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>明日: {weather.tomorrow.icon} {weather.tomorrow.tempMax}℃ / {weather.tomorrow.tempMin}℃</div>}
    </div>
  )

  /* ── [1] Today's Habits ── */

  const HabitsSection = (
    <div className="section">
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{habitsAllDone ? '今日の習慣 — All done!' : '今日の習慣'}</span>
        {dailyHabits.length > 0 && (
          <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
            {dailyHabitsCompleted}/{dailyHabits.length}
          </span>
        )}
      </div>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 8, gap: 4 }}>
          <button className="btn btn-g btn-sm" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 11, padding: '3px 8px' }} onClick={() => setShowAddHabit((v) => !v)}>+</button>
          <button className="btn btn-g btn-sm" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 11, padding: '3px 8px' }} onClick={() => navigate('/habits')}>詳細</button>
        </div>
        {/* Inline add habit */}
        {showAddHabit && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input
              className="input"
              placeholder="新しい習慣..."
              value={newHabitTitle}
              onChange={(e) => setNewHabitTitle(e.target.value)}
              autoFocus
              style={{ flex: 1, fontSize: 13, padding: '6px 10px' }}
            />
            <button
              className="btn btn-p btn-sm"
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
          {(timeMode === 'morning' ? todayHabits : [...todayHabits].sort((a, b) => Number(a.completed) - Number(b.completed))).map((h) => (
            <div
              key={h.id}
              style={{ padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
              onClick={() => toggleHabitLog(h, todayStr)}
            >
              <span style={{
                width: 18, height: 18, borderRadius: 4,
                border: `2px solid ${h.doneToday ? 'var(--green)' : 'var(--border)'}`,
                background: h.doneToday ? 'var(--green)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: '#fff', flexShrink: 0, transition: 'all .2s',
              }}>
                {h.doneToday ? '✓' : ''}
              </span>
              <span style={{ color: 'var(--text)', fontWeight: 500, flex: 1 }}>
                {h.icon} {h.title}
                {h.completed && <span style={{ fontSize: 9, color: 'var(--green)', marginLeft: 4, fontWeight: 600 }}>達成</span>}
              </span>
              {/* Period badge: shown for weekly/monthly habits */}
              {h.frequency !== 'daily' && (
                <span style={{
                  fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 3,
                  color: h.completed ? 'var(--green)' : 'var(--text3)',
                  background: h.completed ? 'var(--green-bg)' : 'var(--surface2)',
                  border: `1px solid ${h.completed ? 'var(--green)' : 'var(--border)'}`,
                  fontFamily: 'var(--mono)',
                }}>
                  {h.periodCount}/{h.target_count} {h.frequency === 'weekly' ? '/週' : '/月'}
                </span>
              )}
              {h.frequency === 'daily' && h.target_count > 1 && (
                <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: h.completed ? 'var(--green)' : 'var(--text3)' }}>
                  {h.todayCount}/{h.target_count}
                </span>
              )}
            </div>
          ))}
        {todayHabits.length === 0 && !showAddHabit && (
          <div style={{ padding: '6px 0', fontSize: 12, color: 'var(--text3)' }}>習慣なし — + で追加</div>
        )}
      </Card>
    </div>
  )

  /* ── [2] Timeline — 3 blocks: time-bound / time-undefined / upcoming ── */

  const hasAnyTimelineContent =
    filteredSlots.length > 0 ||
    todayTasks.length > 0 ||
    completedToday.length > 0 ||
    upcomingTasks.length > 0 ||
    tomorrowEvents.length > 0

  const ScheduledBlockLabel = ({ label }: { label: string }) => (
    <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text3)', marginTop: 12, marginBottom: 6 }}>
      {label}
    </div>
  )

  const TimelineSection = (
    <div className="section">
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>今日の予定</span>
        <button className="btn btn-g btn-sm" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 11, padding: '3px 8px' }} onClick={() => navigate('/calendar')}>カレンダー</button>
      </div>
      {timelineLoading ? (
        <Card>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < 2 ? '1px solid var(--border)' : 'none', alignItems: 'center' }}>
              <div className="skeleton" style={{ width: 42, height: 12, minHeight: 12 }} />
              <div className="skeleton" style={{ flex: 1, height: 12, minHeight: 12 }} />
            </div>
          ))}
          <div style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'center', marginTop: 6 }}>予定を読み込み中…</div>
        </Card>
      ) : !hasAnyTimelineContent ? (
        calendarAuthenticated === false ? (
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10, padding: 6 }}>
              <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>
                Google Calendar と連携すると、今日の予定がここに表示されます。
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={startCalendarAuth}
                style={{ fontSize: 12, padding: '6px 14px' }}
              >
                Sign in with Google
              </button>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>
                連携を後回しにする場合は <span style={{ textDecoration: 'underline', cursor: 'pointer' }} onClick={() => navigate('/calendar')}>カレンダーページ</span> からも設定できます
              </div>
            </div>
          </Card>
        ) : (
          <Card>
            <div style={{ fontSize: 13, color: 'var(--text3)', padding: 4, marginBottom: 8 }}>今日はフリーです — タスクを追加して一日を組み立てましょう</div>
            {!showAddTask ? (
              <button className="btn btn-g btn-sm" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setShowAddTask(true)}>+ タスクを追加</button>
            ) : (
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <input
                  className="input"
                  placeholder="新しいタスク..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  autoFocus
                  style={{ flex: 1, fontSize: 13, padding: '6px 10px' }}
                />
                <button
                  className="btn btn-p btn-sm"
                  disabled={!newTaskTitle.trim()}
                  onClick={() => {
                    if (newTaskTitle.trim()) {
                      addTask({ title: newTaskTitle.trim(), due_date: todayStr })
                      setNewTaskTitle('')
                      setShowAddTask(false)
                      toast('タスクを追加しました')
                    }
                  }}
                >追加</button>
              </div>
            )}
          </Card>
        )
      ) : (
        <Card>
        {/* (a) Time-bound: calendar events + timed tasks in 30-min slots */}
        {filteredSlots.length > 0 && (
          <>
            <ScheduledBlockLabel label="時間指定" />
        {filteredSlots.map((slot, si) => {
          const isCurrentSlot = slot.time === nowMarkerTime
          return (
            <div key={slot.time}>
              {/* Now marker */}
              {isCurrentSlot && (
                <div style={{ position: 'relative', height: 0, marginBottom: 2 }}>
                  <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 2, background: 'var(--red)', borderRadius: 1, opacity: 0.7 }} />
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: si < filteredSlots.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ fontWeight: 600, fontFamily: 'var(--mono)', color: isCurrentSlot ? 'var(--red)' : 'var(--text3)', minWidth: 42, fontSize: 12, paddingTop: 1 }}>{slot.time}</span>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {slot.items.map((item: TimelineItem) => {
                    if (item.type === 'event') {
                      const endTime = formatEventTime(item.endTime)
                      return (
                        <div key={item.id} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, opacity: item.isPast ? 0.5 : 1 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                          <span style={{ textDecoration: item.isPast ? 'line-through' : 'none' }}>{item.title}</span>
                          {endTime && <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>~{endTime}</span>}
                        </div>
                      )
                    }
                    // Task
                    return (
                      <div key={item.id} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, opacity: item.isPast && item.completed ? 0.5 : 1 }}>
                        <span
                          onClick={() => {
                            const newStatus = item.completed ? 'open' : 'done'
                            updateTask(item.id, { status: newStatus, completed_at: newStatus === 'done' ? new Date().toISOString() : null })
                            toast(newStatus === 'done' ? '完了!' : '戻しました')
                          }}
                          style={{
                            width: 16, height: 16, borderRadius: 3, flexShrink: 0, cursor: 'pointer',
                            border: `2px solid ${item.completed ? 'var(--green)' : 'var(--border)'}`,
                            background: item.completed ? 'var(--green)' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 9, color: '#fff', transition: 'all .15s',
                          }}
                        >{item.completed ? '✓' : ''}</span>
                        <span style={{ textDecoration: item.completed ? 'line-through' : 'none', color: item.completed ? 'var(--text3)' : 'var(--text)', fontWeight: 500 }}>
                          {item.title}
                        </span>
                        {item.isDeadline && <span style={{ fontSize: 9, color: 'var(--red)', fontWeight: 600, padding: '1px 4px', background: 'var(--red-bg)', borderRadius: 3, border: '1px solid var(--red-border)' }}>〆</span>}
                        {item.estimatedMinutes && <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{item.estimatedMinutes}min</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
          </>
        )}

        {/* (b) Time-undefined: tasks due today with no specific time */}
        {(todayTasks.length > 0 || completedUntimedToday.length > 0 || showAddTask) && (
          <>
            <ScheduledBlockLabel label="時間未定" />
            {showAddTask && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input
                  className="input"
                  placeholder="新しいタスク..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  autoFocus
                  style={{ flex: 1, fontSize: 13, padding: '6px 10px' }}
                />
                <button
                  className="btn btn-p btn-sm"
                  disabled={!newTaskTitle.trim()}
                  onClick={() => {
                    if (newTaskTitle.trim()) {
                      addTask({ title: newTaskTitle.trim(), due_date: todayStr })
                      setNewTaskTitle('')
                      setShowAddTask(false)
                      toast('タスクを追加しました')
                    }
                  }}
                >追加</button>
              </div>
            )}
            {todayTasks.map((t) => (
              <TaskRow key={t.id} task={t} todayStr={todayStr} done={false} onToggle={() => { updateTask(t.id, { status: 'done', completed_at: new Date().toISOString() }); toast('完了!') }} onUpdate={(id, data) => { updateTask(id, data); toast('更新しました') }} />
            ))}
            {completedUntimedToday.map((t) => (
              <TaskRow key={t.id} task={t} todayStr={todayStr} done onToggle={() => { updateTask(t.id, { status: 'open', completed_at: null }); toast('戻しました') }} onUpdate={(id, data) => { updateTask(id, data); toast('更新しました') }} />
            ))}
          </>
        )}

        {/* Inline "+" when there are events but no time-undefined tasks yet */}
        {!showAddTask && todayTasks.length === 0 && completedToday.length === 0 && filteredSlots.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <button className="btn btn-g btn-sm" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => setShowAddTask(true)}>+ 時間未定のタスクを追加</button>
          </div>
        )}

        {/* (c) Upcoming: tomorrow's calendar events + tasks with deadline in next 7 days */}
        {(upcomingTasks.length > 0 || tomorrowEvents.length > 0) && (
          <>
            <ScheduledBlockLabel label="近日（明日〜今週）" />
            {tomorrowEvents.slice(0, 5).map((e) => (
              <div key={e.id} style={{ padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                <span style={{ flex: 1, color: 'var(--text2)' }}>{e.title}</span>
                <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 3, color: 'var(--accent2)', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', fontFamily: 'var(--mono)' }}>明日 {formatEventTime(e.startTime)}</span>
              </div>
            ))}
            {tomorrowEvents.length > 5 && <div style={{ padding: '5px 0', fontSize: 11, color: 'var(--text3)' }}>他 {tomorrowEvents.length - 5}件（明日）</div>}
            {upcomingTasks.slice(0, 5).map((t) => {
              const due = formatDueDate(t.due_date, todayStr)
              return (
                <div key={t.id} style={{ padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text3)', flexShrink: 0 }} />
                  <span style={{ flex: 1, color: 'var(--text2)' }}>{t.title}</span>
                  {due && <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 3, color: due.color, background: due.bg, border: `1px solid ${due.border}`, fontFamily: 'var(--mono)' }}>{due.label}</span>}
                </div>
              )
            })}
            {upcomingTasks.length > 5 && <div style={{ padding: '5px 0', fontSize: 11, color: 'var(--text3)' }}>他 {upcomingTasks.length - 5}件</div>}
          </>
        )}
      </Card>
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

  /* ── [3] 未来のあなたから（クリックで対話展開） ── */

  const Briefing = (
    <FutureYouChat entryPoint="today_partner" briefingMessage={briefingMessage} />
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

  const NewsSection = (
    <Card style={{ marginBottom: 16 }}>
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>ニュース</span>
        <button className="btn btn-g btn-sm" style={{ fontSize: 10 }} onClick={handleCollectNews} disabled={newsCollecting}>
          {newsCollecting ? '収集中...' : '最新を取得'}
        </button>
      </div>
      {newsItems.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 0' }}>ニュースはまだありません</div>
      ) : (
        newsItems.map((n) => (
          <div key={n.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {n.url ? (
                <a href={n.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 500, color: 'var(--text)', textDecoration: 'none' }}
                  onClick={() => { if (n.id) import('@/lib/newsCollect').then(({ recordClick }) => recordClick(n.id!)) }}
                >{n.title_ja || n.title}</a>
              ) : (
                <span style={{ fontWeight: 500 }}>{n.title_ja || n.title}</span>
              )}
            </div>
            {n.summary && <div style={{ color: 'var(--text3)', marginTop: 2, fontSize: 11 }}>{n.summary}</div>}
            <div style={{ display: 'flex', gap: 6, marginTop: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              {n.published_date && <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{n.published_date.substring(5)}</span>}
              {n.source && <span style={{ fontSize: 10, color: 'var(--text3)' }}>{n.source}</span>}
              {n.source_type && (
                <span style={{
                  fontSize: 9, padding: '1px 4px', borderRadius: 3, fontWeight: 600, fontFamily: 'var(--mono)',
                  color: n.source_type === 'arxiv' ? '#b91c1c' : n.source_type === 'hackernews' ? '#ea580c' : n.source_type === 'rss_feed' ? 'var(--green)' : 'var(--accent)',
                  background: n.source_type === 'arxiv' ? '#fef2f2' : n.source_type === 'hackernews' ? '#fff7ed' : n.source_type === 'rss_feed' ? 'var(--green-bg)' : 'var(--accent-bg)',
                }}>
                  {n.source_type === 'google_news' ? 'NEWS' : n.source_type === 'arxiv' ? 'PAPER' : n.source_type === 'hackernews' ? 'HN' : n.source_type === 'rss_feed' ? 'BLOG' : n.source_type}
                </span>
              )}
              {n.topic && <span style={{ fontSize: 10, color: 'var(--accent2)' }}>{n.topic}</span>}
              {n.id && (
                <button
                  className="btn btn-g btn-sm"
                  style={{ fontSize: 9, padding: '1px 6px', marginLeft: 'auto' }}
                  disabled={translatingNewsId === n.id}
                  onClick={(e) => { e.stopPropagation(); handleTranslateNews(n.id!) }}
                  title={n.title_ja ? '日本語要約を再生成' : '日本語に翻訳'}
                >
                  {translatingNewsId === n.id ? '翻訳中' : n.title_ja ? '再翻訳' : '日本語訳'}
                </button>
              )}
            </div>
          </div>
        ))
      )}
      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <button className="btn btn-g btn-sm" style={{ fontSize: 10 }} onClick={() => navigate('/news')}>
          もっと見る →
        </button>
        <button className="btn btn-g btn-sm" style={{ fontSize: 10 }} onClick={() => navigate('/news#sources')}>
          ソース設定
        </button>
      </div>
    </Card>
  )

  /* ── [4] Diary ── */

  const Diary = (
    <Card style={{ marginBottom: 16 }}>
      <textarea
        className="input"
        placeholder={diaryPrompt}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && (text.trim() || pendingImages.length > 0) && !saving && !analyzing) { e.preventDefault(); saveEntry(text) } }}
        style={{ minHeight: timeMode === 'evening' ? 100 : 44, width: '100%', boxSizing: 'border-box', marginBottom: 8 }}
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
  )

  /* ── [5] Fragments ── */

  const Fragments = fragments.length > 0 ? (
    <div className="section">
      <div className="section-title">今日の断片</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {fragments.map((f: DiaryEntry) => {
          const badges = emotionBadges.get(f.id) || []
          return (
            <Card key={f.id} style={{ padding: 14 }}>
              <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{f.body}</div>
              {f.image_urls && f.image_urls.length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  {f.image_urls.map((path, i) => (
                    <DiaryImageThumb key={i} path={path} size={80} />
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                  {new Date(f.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                </span>
                {badges.map((b) => (
                  <span key={b.key} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 10, background: b.color, color: '#fff', fontWeight: 600, opacity: 0.85 }}>
                    {b.label} {b.value}
                  </span>
                ))}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  ) : null

  /* ── [6] Status bar (streak, dreams, WBI) ── */

  const StatusBar = (streak > 0 || dreamsCount > 0 || wbi !== null) ? (
    <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      {streak > 0 && <span><span style={{ color: '#ff6b35', fontWeight: 600 }}>{streak}</span>日連続記録</span>}
      {wbi !== null && <span>WBI <span style={{ fontWeight: 600, fontFamily: 'var(--mono)' }}>{wbi.toFixed(1)}</span></span>}
      {dreamsCount > 0 && (
        <span style={{ cursor: 'pointer' }} onClick={() => navigate('/dreams')}>
          <span style={{ color: 'var(--accent2)', fontWeight: 600 }}>{dreamsCount}</span> 個の夢が進行中
        </span>
      )}
    </div>
  ) : null

  /* ── Deadlines section — overdue / today / tomorrow / this week ── */

  const DeadlinesSection = hasDeadlineAlert ? (
    <div className="section">
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>締切</span>
        <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
          {deadlineBuckets.overdue.length > 0 && (
            <span style={{ color: 'var(--red)', marginRight: 8 }}>遅延 {deadlineBuckets.overdue.length}</span>
          )}
          今日 {deadlineBuckets.dueToday.length} / 明日 {deadlineBuckets.dueTomorrow.length} / 今週 {deadlineBuckets.dueThisWeek.length}
        </span>
      </div>
      <Card>
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
    </div>
  ) : null

  /* ── [7] Backlog (other open tasks, shown only if relevant) ── */

  const Backlog = otherOpenTasks.length > 0 ? (
    <div className="section">
      <div className="section-title">バックログ</div>
      <Card>
        {otherOpenTasks.slice(0, 3).map((t) => (
          <div key={t.id} style={{ padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text2)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text3)', flexShrink: 0 }} />
            {t.title}
          </div>
        ))}
        {otherOpenTasks.length > 3 && <div style={{ padding: '5px 0', fontSize: 11, color: 'var(--text3)' }}>他 {otherOpenTasks.length - 3}件</div>}
      </Card>
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

        {/* AI が用意した「今日のひと言」(MorningBriefing) */}
        {Briefing}

        {/* 朝の名言 (受動表示) */}
        <MorningQuoteCard />

        {/* 未処理の AI 提案 (Pending updates) */}
        <PendingUpdatesBanner />

        {/* 今日締切アラート — 書く前に「気にすべきこと」を脳にセット */}
        {DeadlinesSection}

        {/* 日記入力（プロンプト + textarea + similar-while-writing + save + extraction-detail） */}
        {Diary}

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
