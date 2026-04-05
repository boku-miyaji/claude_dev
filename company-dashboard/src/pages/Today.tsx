import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { calculateStreak } from '@/lib/streak'
import { Card } from '@/components/ui'
import { useEmotionAnalysis } from '@/hooks/useEmotionAnalysis'
import { useMorningBriefing } from '@/hooks/useMorningBriefing'
import { useDreamDetection } from '@/hooks/useDreamDetection'
import { useTodayWeather } from '@/hooks/useTodayWeather'
import { useTodaySchedule } from '@/hooks/useTodaySchedule'
import { toast } from '@/components/ui'
import { useDataStore } from '@/stores/data'
import { useBriefingStore } from '@/stores/briefing'
import { getTimeMode, getGreeting, formatToday, getDiaryPrompt } from '@/lib/timeMode'
import type { TimeMode } from '@/lib/timeMode'
import type { DiaryEntry } from '@/types/diary'
import { supabase } from '@/lib/supabase'

/* ── Analysis Questions for Self-Analysis Precision ── */

// カテゴリは「分析タイプ」ではなく「日記で不足しがちな情報」の軸で設計
// 日記テキストから検出しにくいデータを自然に引き出す
const ANALYSIS_QUESTIONS: Record<string, string[]> = {
  // 人間関係（日記で最も見落とされやすい領域）
  relationships: [
    '今日、誰と話した？どんな気持ちだった？',
    '最近、誰かを元気づけたり励ましたことは？',
    '1対1で深く話せた相手は最近いる？',
    '今日、誰かのために何かした？',
    '最近、友達や仲間との関係で嬉しかったことは？',
    '誰かと意見が合わなかった時、どう対応した？',
    '最近会った人の中で、印象に残った人は？なぜ？',
  ],
  // ポジティブ面（日記はネガティブに偏りやすい）
  positive: [
    '今日の小さな幸せは何だった？',
    '最近、笑った瞬間は？何がおかしかった？',
    '今日うまくいったことは？',
    '最近、場の雰囲気を明るくした場面はあった？',
    '感謝したいことは？',
    '今日、楽しみにしていることは？',
  ],
  // 行動パターン（思考ではなく実際の行動を記録）
  actions: [
    '今日、一番時間を使ったことは？',
    '計画通りにできたこと、できなかったことは？',
    '今日、自分から始めたことはある？',
    '最近、誰かに頼まれて動いたことは？',
    '後回しにしていることはある？なぜ？',
    '今日、新しく試したことはある？',
  ],
  // 意思決定・価値観（判断基準を引き出す）
  decisions: [
    '今日、迷って決めたことは？何が決め手だった？',
    '最近「これは譲れない」と思ったことは？',
    '自分のやり方を変えた場面はあった？',
    '今の生活で一番大事にしていることは？',
    '最近、直感で決めたことと論理で決めたこと、どちらが多い？',
  ],
  // 内面・感情（従来の感情質問を維持）
  inner: [
    '今の気持ちを一言で表すと？',
    '最近、一人の時間で何をしていた？',
    'エネルギーが湧いてきた瞬間は？逆に消耗した瞬間は？',
    '最近、自分の成長を感じたことは？',
    '今、一番気になっていることは？',
  ],
}

/** Get today's analysis questions based on date rotation */
function getTodayQuestions(todayStr: string): string[] {
  const categories = Object.keys(ANALYSIS_QUESTIONS)
  // Use date string to create a deterministic seed
  const seed = todayStr.split('-').reduce((acc, n) => acc + parseInt(n, 10), 0)
  // Pick 2 categories based on date
  const cat1 = categories[seed % categories.length]
  const cat2 = categories[(seed + 3) % categories.length]
  // Pick 1 question from each category
  const q1 = ANALYSIS_QUESTIONS[cat1][seed % ANALYSIS_QUESTIONS[cat1].length]
  const q2Arr = ANALYSIS_QUESTIONS[cat2]
  const q2 = q2Arr[(seed + 2) % q2Arr.length]
  // Avoid duplicates
  if (q1 === q2) return [q1]
  return [q1, q2]
}

/* ── Constants ── */

const PLUTCHIK_LABELS: Record<string, { label: string; color: string }> = {
  joy: { label: 'Joy', color: '#FFD700' },
  trust: { label: 'Trust', color: '#98FB98' },
  fear: { label: 'Fear', color: '#228B22' },
  surprise: { label: 'Surprise', color: '#00CED1' },
  sadness: { label: 'Sadness', color: '#4169E1' },
  disgust: { label: 'Disgust', color: '#9370DB' },
  anger: { label: 'Anger', color: '#FF4500' },
  anticipation: { label: 'Anticipation', color: '#FFA500' },
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

function TaskRow({ task: t, todayStr, done, onToggle, onUpdate }: {
  task: { id: string; title: string; due_date: string | null; priority: string; status: string }
  todayStr: string
  done: boolean
  onToggle: () => void
  onUpdate: (id: string, data: Record<string, unknown>) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(t.title)
  const [editDue, setEditDue] = useState(t.due_date || '')
  const [editPriority, setEditPriority] = useState(t.priority)
  const due = formatDueDate(t.due_date, todayStr)

  const save = () => {
    const updates: Record<string, unknown> = {}
    if (editTitle.trim() && editTitle.trim() !== t.title) updates.title = editTitle.trim()
    if (editDue !== (t.due_date || '')) updates.due_date = editDue || null
    if (editPriority !== t.priority) updates.priority = editPriority
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
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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
          <div style={{ flex: 1 }} />
          <button className="btn btn-g btn-sm" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => setEditing(false)}>Cancel</button>
          <button className="btn btn-p btn-sm" style={{ fontSize: 11, padding: '3px 8px' }} onClick={save}>Save</button>
        </div>
      </div>
    )
  }

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
        onClick={() => { if (!done) { setEditTitle(t.title); setEditDue(t.due_date || ''); setEditPriority(t.priority); setEditing(true) } }}
        style={{ flex: 1, fontWeight: 500, textDecoration: done ? 'line-through' : 'none', color: done ? 'var(--text3)' : 'var(--text)', cursor: done ? 'default' : 'pointer' }}
      >
        {t.title}
      </span>
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
  const [emotionBadges, setEmotionBadges] = useState<Map<string, EmotionBadge[]>>(new Map())
  const { analyze, analyzing, error: emotionError } = useEmotionAnalysis()
  const { detect } = useDreamDetection()
  const weather = useTodayWeather()
  const { todayEvents, tomorrowEvents, recentEventName } = useTodaySchedule()

  const timeMode: TimeMode = useMemo(() => getTimeMode(), [])

  const todayEventsText = useMemo(() => {
    if (todayEvents.length === 0) return undefined
    return todayEvents.map((e) => `${formatEventTime(e.start)} ${e.summary}${e.isPast ? ' (完了)' : ''}`).join('\n')
  }, [todayEvents])

  const tomorrowEventsText = useMemo(() => {
    if (tomorrowEvents.length === 0) return undefined
    return tomorrowEvents.map((e) => `${formatEventTime(e.start)} ${e.summary}`).join('\n')
  }, [tomorrowEvents])

  const { message: briefingMessage, loading: briefingLoading } = useMorningBriefing(timeMode, todayEventsText, tomorrowEventsText)

  const {
    diaryEntries, tasks, dreams, habits, habitLogs,
    fetchDiary, fetchTasks, fetchDreams, fetchHabits, fetchHabitLogs, fetchEmotions,
    addDiaryEntry, toggleHabitLog,
    addTask, updateTask, addHabit,
    loading,
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

  /* ── Computed data ── */

  const fragments = useMemo(() => diaryEntries.filter((e) => e.created_at.substring(0, 10) === todayStr), [diaryEntries, todayStr])

  // Tasks: today's actionable items (requests are excluded — they live in the Tasks page)
  const allOpenTasks = useMemo(() => tasks.filter((t) => (t.status === 'open' || t.status === 'in_progress') && t.type !== 'request'), [tasks])
  const completedToday = useMemo(() => tasks.filter((t) => t.status === 'done' && t.type !== 'request' && t.completed_at?.substring(0, 10) === todayStr), [tasks, todayStr])

  const priorityWeight = { high: 0, normal: 1, low: 2 } as const

  const todayTasks = useMemo(() => {
    // Overdue, due today, high priority, or in_progress
    const relevant = allOpenTasks.filter((t) =>
      (t.due_date && t.due_date <= todayStr) || t.priority === 'high' || t.status === 'in_progress',
    )
    // Sort: overdue first → due today → due later/none. Within same date group, by priority.
    return [...relevant].sort((a, b) => {
      const aDate = a.due_date || '9999-99-99'
      const bDate = b.due_date || '9999-99-99'
      if (aDate !== bDate) return aDate < bDate ? -1 : 1
      return (priorityWeight[a.priority] ?? 1) - (priorityWeight[b.priority] ?? 1)
    })
  }, [allOpenTasks, todayStr])

  const otherOpenTasks = useMemo(() => {
    const todayIds = new Set(todayTasks.map((t) => t.id))
    const others = allOpenTasks.filter((t) => !todayIds.has(t.id))
    // Sort by due_date (soonest first), then priority
    return [...others].sort((a, b) => {
      const aDate = a.due_date || '9999-99-99'
      const bDate = b.due_date || '9999-99-99'
      if (aDate !== bDate) return aDate < bDate ? -1 : 1
      return (priorityWeight[a.priority] ?? 1) - (priorityWeight[b.priority] ?? 1)
    })
  }, [allOpenTasks, todayTasks])

  // Habits
  const todayHabits = useMemo(() => {
    return habits.map((habit) => {
      const todayCount = habitLogs.filter((l) => l.habit_id === habit.id && l.completed_at.substring(0, 10) === todayStr).length
      return { ...habit, todayCount, completed: todayCount >= habit.target_count }
    })
  }, [habits, habitLogs, todayStr])
  const habitsCompleted = todayHabits.filter((h) => h.completed).length

  // Combined progress
  const totalActions = todayTasks.length + todayHabits.length
  const doneActions = completedToday.length + habitsCompleted
  const actionProgress = totalActions > 0 ? doneActions / (todayTasks.length + todayHabits.length + completedToday.length) : 0
  // For display: done / (active + done)
  const totalWithCompleted = todayTasks.length + todayHabits.length + completedToday.length
  const allDone = totalActions > 0 && todayTasks.length === 0 && habitsCompleted === todayHabits.length

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

  const invalidateBriefing = useBriefingStore((s) => s.invalidate)

  const saveEntry = useCallback(async (content: string) => {
    if (!content.trim()) return
    setSaving(true)
    const inserted = await addDiaryEntry({ body: content.trim(), entry_type: 'fragment', entry_date: todayStr })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setText('')
    if (inserted?.id) {
      const result = await analyze(inserted.id, content.trim())
      if (result) {
        const scores = Object.entries(PLUTCHIK_LABELS).map(([key, info]) => ({
          key, label: info.label, color: info.color, value: result.plutchik[key] ?? 0,
        }))
        scores.sort((a, b) => b.value - a.value)
        setEmotionBadges((prev) => { const next = new Map(prev); next.set(inserted.id, scores.filter((s) => s.value > 20).slice(0, 2)); return next })
      }
      detect(content.trim()).then((detections) => { for (const d of detections) toast(`夢『${d.dream_title}』に近づいているかもしれません！`) })
      // Re-generate AI comment with new diary context
      invalidateBriefing()
    }
  }, [addDiaryEntry, analyze, detect, todayStr, invalidateBriefing])

  const diaryPrompt = useMemo(() => getDiaryPrompt(timeMode, recentEventName ?? undefined), [timeMode, recentEventName])
  const todayQuestions = useMemo(() => getTodayQuestions(todayStr), [todayStr])

  const isLoading = loading.diary || loading.tasks || loading.dreams
  if (isLoading && fragments.length === 0) {
    return (
      <div className="page">
        <div className="page-title">{getGreeting(timeMode)}</div>
        <div style={{ color: 'var(--text3)', marginTop: 12 }}>Loading...</div>
      </div>
    )
  }

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

  /* ── [1] Today's Actions — unified tasks + habits ── */

  const ActionsSection = (
    <div className="section">
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>
          {timeMode === 'morning' ? '今日やること' : timeMode === 'afternoon' ? (allDone ? '今日やること — All done!' : `今日やること — あと${todayTasks.length + todayHabits.length - habitsCompleted}件`) : (allDone ? '今日の達成' : `今日の達成 — ${todayTasks.length + todayHabits.length - habitsCompleted}件やり残し`)}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
          {doneActions}/{totalWithCompleted}
        </span>
      </div>

      {/* Combined progress bar */}
      <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{
          height: '100%', borderRadius: 2, transition: 'width .3s ease',
          width: `${Math.round(actionProgress * 100)}%`,
          background: allDone ? 'var(--green)' : 'var(--accent)',
        }} />
      </div>

      {/* Tasks */}
      <Card style={{ marginBottom: todayHabits.length > 0 ? 10 : 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text3)' }}>Tasks</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn btn-g btn-sm" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 11, padding: '3px 8px' }} onClick={() => setShowAddTask((v) => !v)}>+</button>
            <button className="btn btn-g btn-sm" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 11, padding: '3px 8px' }} onClick={() => navigate('/tasks')}>
              {allOpenTasks.length > todayTasks.length ? `他${allOpenTasks.length - todayTasks.length}件` : '一覧'}
            </button>
          </div>
        </div>
        {/* Inline add task */}
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
        {/* Completed today — strikethrough, click to undo */}
        {completedToday.map((t) => (
          <TaskRow key={t.id} task={t} todayStr={todayStr} done onToggle={() => { updateTask(t.id, { status: 'open', completed_at: null }); toast('戻しました') }} onUpdate={(id, data) => { updateTask(id, data); toast('更新しました') }} />
        ))}
        {todayTasks.length === 0 && completedToday.length === 0 && !showAddTask && (
          <div style={{ padding: '6px 0', fontSize: 12, color: 'var(--text3)' }}>タスクなし — + で追加</div>
        )}
      </Card>

      {/* Habits */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text3)' }}>Habits</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn btn-g btn-sm" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 11, padding: '3px 8px' }} onClick={() => setShowAddHabit((v) => !v)}>+</button>
            <button className="btn btn-g btn-sm" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 11, padding: '3px 8px' }} onClick={() => navigate('/habits')}>詳細</button>
          </div>
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
                border: `2px solid ${h.completed ? 'var(--green)' : 'var(--border)'}`,
                background: h.completed ? 'var(--green)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: '#fff', flexShrink: 0, transition: 'all .2s',
              }}>
                {h.completed ? '✓' : ''}
              </span>
              <span style={{ color: h.completed ? 'var(--text3)' : 'var(--text)', textDecoration: h.completed ? 'line-through' : 'none', fontWeight: 500, flex: 1 }}>
                {h.icon} {h.title}
              </span>
              {h.target_count > 1 && (
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

  /* ── [2] Schedule ── */

  const scheduleEvents = timeMode === 'afternoon' ? todayEvents.filter((e) => !e.isPast) : todayEvents
  const Schedule = (
    <div className="section">
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{timeMode === 'afternoon' ? 'この後の予定' : '今日のスケジュール'}</span>
        <button className="btn btn-g btn-sm" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 11, padding: '3px 8px' }} onClick={() => navigate('/calendar')}>カレンダー</button>
      </div>
      <Card>
        {scheduleEvents.length > 0 ? scheduleEvents.map((e) => (
          <div key={e.id} style={{ padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13, display: 'flex', gap: 10, opacity: e.isPast ? 0.5 : 1 }}>
            <span style={{ fontWeight: 600, fontFamily: 'var(--mono)', color: 'var(--text2)', minWidth: 42 }}>{formatEventTime(e.start)}</span>
            <span style={{ color: 'var(--text)', textDecoration: e.isPast ? 'line-through' : 'none' }}>{e.summary}</span>
          </div>
        )) : (
          <div style={{ padding: '6px 0', fontSize: 12, color: 'var(--text3)' }}>予定なし</div>
        )}
      </Card>
    </div>
  )

  const Tomorrow = tomorrowEvents.length > 0 ? (
    <div className="section">
      <div className="section-title">明日の予定</div>
      <Card>
        {tomorrowEvents.slice(0, 3).map((e) => (
          <div key={e.id} style={{ padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13, display: 'flex', gap: 10 }}>
            <span style={{ fontWeight: 600, fontFamily: 'var(--mono)', color: 'var(--text2)', minWidth: 42 }}>{formatEventTime(e.start)}</span>
            <span>{e.summary}</span>
          </div>
        ))}
        {tomorrowEvents.length > 3 && <div style={{ padding: '5px 0', fontSize: 11, color: 'var(--text3)' }}>他 {tomorrowEvents.length - 3}件</div>}
      </Card>
    </div>
  ) : timeMode === 'evening' ? (
    <div className="section">
      <div className="section-title">明日の予定</div>
      <Card><div style={{ fontSize: 13, color: 'var(--text3)', padding: 4 }}>明日はフリーです</div></Card>
    </div>
  ) : null

  /* ── [3] AI Briefing ── */

  const Briefing = (
    <Card style={{ marginBottom: 16, background: 'var(--accent-bg)', border: '1px solid var(--accent-border)' }}>
      <div style={{ fontSize: 11, color: 'var(--accent2)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.08em' }}>AI Partner</div>
      {briefingLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--accent2)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>考え中...</span>
        </div>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>{briefingMessage || '今日も穏やかに過ごせますように。'}</div>
      )}
    </Card>
  )

  /* ── [News] ── */

  const [newsItems, setNewsItems] = useState<Array<{id: string; title: string; summary: string; url: string | null; source: string; topic: string}>>([])
  const [newsCollecting, setNewsCollecting] = useState(false)

  useEffect(() => {
    supabase.from('news_items').select('id,title,summary,url,source,topic').order('collected_at', { ascending: false }).limit(5)
      .then(({ data }) => { if (data) setNewsItems(data) })
  }, [])

  async function handleCollectNews() {
    setNewsCollecting(true)
    try {
      const edgeAi = await import('@/lib/edgeAi')
      const prefRes = await supabase.from('news_preferences').select('topic,interest_score').order('interest_score', { ascending: false })
      const topTopics = (prefRes.data || []).filter((p: { interest_score: number }) => p.interest_score >= 0.5).map((p: { topic: string }) => p.topic)
      let topicPrompt = 'AI/LLM、データプラットフォーム、Claude、OpenAI'
      if (topTopics.length > 0) topicPrompt += '\n関心トピック: ' + topTopics.join('、')

      const data = await edgeAi.aiCompletion(
        topicPrompt + ' の最新ニュース5件をJSON配列で。[{"title":"","summary":"","url":"","source":"","topic":"","date":"YYYY-MM-DD"}]',
        { systemPrompt: 'JSON配列のみ出力。', model: 'gpt-5-nano', maxTokens: 1500, source: 'news_collect' }
      )
      const match = data.content.match(/\[[\s\S]*\]/)
      if (match) {
        const items = JSON.parse(match[0])
        for (const n of items) {
          if (n.title?.length > 5) await supabase.from('news_items').insert({ title: n.title?.substring(0, 200), summary: n.summary?.substring(0, 300), url: n.url || null, source: n.source?.substring(0, 50), topic: n.topic?.substring(0, 30), published_date: n.date || null })
        }
        toast(items.length + '件のニュースを収集しました')
        const { data: fresh } = await supabase.from('news_items').select('id,title,summary,url,source,topic').order('collected_at', { ascending: false }).limit(5)
        if (fresh) setNewsItems(fresh)
      }
    } catch (e) { toast('ニュース収集に失敗しました') }
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
                <a href={n.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 500, color: 'var(--text)', textDecoration: 'none' }}>{n.title}</a>
              ) : (
                <span style={{ fontWeight: 500 }}>{n.title}</span>
              )}
            </div>
            {n.summary && <div style={{ color: 'var(--text3)', marginTop: 2, fontSize: 11 }}>{n.summary}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
              {n.source && <span style={{ fontSize: 10, color: 'var(--text3)' }}>{n.source}</span>}
              {n.topic && <span style={{ fontSize: 10, color: 'var(--accent2)' }}>{n.topic}</span>}
            </div>
          </div>
        ))
      )}
      <div style={{ marginTop: 8 }}>
        <button className="btn btn-g btn-sm" style={{ fontSize: 10 }} onClick={() => navigate('/news')}>
          もっと見る →
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
        style={{ minHeight: timeMode === 'evening' ? 100 : 44, width: '100%', boxSizing: 'border-box', marginBottom: 8 }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>
          {saving ? '保存中...' : saved ? '保存しました' : analyzing ? '感情分析中...' : ''}
        </span>
        <button className="btn btn-p btn-sm" onClick={() => saveEntry(text)} disabled={!text.trim() || saving || analyzing}>
          {analyzing ? '分析中...' : '記録する'}
        </button>
      </div>
      {emotionError && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{emotionError}</div>}
      {/* Analysis questions - subtle prompts to improve self-analysis precision */}
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {todayQuestions.map((q, i) => (
          <div
            key={i}
            onClick={() => setText((prev) => prev ? `${prev}\n${q} ` : `${q} `)}
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
            {q}
          </div>
        ))}
      </div>
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

  /* ── [7] Backlog (other open tasks, shown only if relevant) ── */

  const Backlog = otherOpenTasks.length > 0 && timeMode !== 'morning' ? (
    <div className="section">
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>バックログ</span>
        <button className="btn btn-g btn-sm" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 11 }} onClick={() => navigate('/tasks')}>すべて見る</button>
      </div>
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
     TIME-ADAPTIVE LAYOUT

     All modes share the same structure:
       Greeting → Actions → Schedule → Context → Reflect

     The difference is emphasis and detail level.
     ════════════════════════════════════════════ */

  if (timeMode === 'morning') {
    return (
      <div className="page">
        {Greeting}
        {Briefing}
        {Schedule}
        {ActionsSection}
        {NewsSection}
        {Diary}
        {StatusBar}
        {Fragments}
      </div>
    )
  }

  if (timeMode === 'afternoon') {
    return (
      <div className="page">
        {Greeting}
        {Briefing}
        {Diary}
        {Schedule}
        {ActionsSection}
        {NewsSection}
        {Backlog}
        {Fragments}
      </div>
    )
  }

  // Evening
  return (
    <div className="page">
      {Greeting}
      {Briefing}
      {ActionsSection}
      {Diary}
      {Backlog}
      {Tomorrow}
      {NewsSection}
      {StatusBar}
      {Fragments}
    </div>
  )
}
