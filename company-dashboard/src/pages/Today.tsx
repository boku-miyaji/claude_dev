import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { calculateStreak } from '@/lib/streak'
import { Card } from '@/components/ui'
import { useEmotionAnalysis } from '@/hooks/useEmotionAnalysis'
import { useMorningBriefing } from '@/hooks/useMorningBriefing'
import { useDreamDetection } from '@/hooks/useDreamDetection'
import { toast } from '@/components/ui'
import { useDataStore } from '@/stores/data'
import type { DiaryEntry } from '@/types/diary'

/** Plutchik emotion labels for badge display */
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

/** Time-based greeting with calm tone */
function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'おやすみ前のひととき'
  if (h < 11) return 'おはようございます'
  if (h < 17) return 'こんにちは'
  return 'おつかれさまです'
}

interface EmotionBadge {
  key: string
  label: string
  color: string
  value: number
}

export function Today() {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [streak, setStreak] = useState(0)
  const [emotionBadges, setEmotionBadges] = useState<Map<string, EmotionBadge[]>>(new Map())
  const { analyze, analyzing, error: emotionError } = useEmotionAnalysis()
  const { message: briefingMessage, loading: briefingLoading } = useMorningBriefing()
  const { detect } = useDreamDetection()

  // Central store
  const {
    diaryEntries, tasks, dreams, habits, habitLogs,
    fetchDiary, fetchTasks, fetchDreams, fetchHabits, fetchHabitLogs, fetchEmotions,
    addDiaryEntry, toggleHabitLog,
    loading,
  } = useDataStore()

  const todayStr = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

  // Fetch all data on mount
  useEffect(() => {
    fetchDiary({ days: 1 })
    fetchEmotions({ days: 1 })
    fetchTasks()
    fetchDreams()
    fetchHabits()
    fetchHabitLogs()
    calculateStreak().then(setStreak)
  }, [fetchDiary, fetchEmotions, fetchTasks, fetchDreams, fetchHabits, fetchHabitLogs])

  // Today's fragments
  const fragments = useMemo(() => {
    return diaryEntries.filter((e) => e.created_at.substring(0, 10) === todayStr)
  }, [diaryEntries, todayStr])

  // Open tasks (top 5)
  const openTasks = useMemo(() => {
    return tasks.filter((t) => t.status === 'open').slice(0, 5)
  }, [tasks])

  // Active dreams count
  const dreamsCount = useMemo(() => {
    return dreams.filter((d) => d.status === 'active' || d.status === 'in_progress').length
  }, [dreams])

  // Latest WBI
  const wbi = useMemo(() => {
    const entry = diaryEntries.find((e) => e.wbi != null)
    return entry?.wbi ?? null
  }, [diaryEntries])

  // Build emotion badges from store emotion data
  const emotionAnalyses = useDataStore((s) => s.emotionAnalyses)
  useEffect(() => {
    if (fragments.length === 0) return
    const entryIds = new Set(fragments.map((e) => e.id))
    const badgeMap = new Map<string, EmotionBadge[]>()
    for (const ea of emotionAnalyses) {
      if (!entryIds.has(ea.diary_entry_id)) continue
      const scores = Object.entries(PLUTCHIK_LABELS).map(([key, info]) => ({
        key,
        label: info.label,
        color: info.color,
        value: (ea as unknown as Record<string, number>)[key] ?? 0,
      }))
      scores.sort((a, b) => b.value - a.value)
      badgeMap.set(ea.diary_entry_id, scores.filter((s) => s.value > 20).slice(0, 2))
    }
    setEmotionBadges(badgeMap)
  }, [fragments, emotionAnalyses])

  // Today's habits
  const todayHabits = useMemo(() => {
    return habits.map((habit) => {
      const todayCount = habitLogs.filter(
        (l) => l.habit_id === habit.id && l.completed_at.substring(0, 10) === todayStr,
      ).length
      const completed = todayCount >= habit.target_count
      return { ...habit, todayCount, completed }
    })
  }, [habits, habitLogs, todayStr])

  /** Save diary entry and trigger emotion analysis */
  const saveEntry = useCallback(async (content: string) => {
    if (!content.trim()) return
    setSaving(true)
    const inserted = await addDiaryEntry({
      body: content.trim(),
      entry_type: 'fragment',
      entry_date: todayStr,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setText('')

    // Trigger emotion analysis in background
    if (inserted?.id) {
      const result = await analyze(inserted.id, content.trim())
      if (result) {
        const scores = Object.entries(PLUTCHIK_LABELS).map(([key, info]) => ({
          key,
          label: info.label,
          color: info.color,
          value: result.plutchik[key] ?? 0,
        }))
        scores.sort((a, b) => b.value - a.value)
        setEmotionBadges((prev) => {
          const next = new Map(prev)
          next.set(inserted.id, scores.filter((s) => s.value > 20).slice(0, 2))
          return next
        })
      }

      // Dream detection in background (non-blocking)
      detect(content.trim()).then((detections) => {
        for (const d of detections) {
          toast(`夢『${d.dream_title}』に近づいているかもしれません！`)
        }
      })
    }
  }, [addDiaryEntry, analyze, detect, todayStr])

  const greeting = getGreeting()
  const isLoading = loading.diary || loading.tasks || loading.dreams

  if (isLoading && fragments.length === 0) {
    return (
      <div className="page">
        <div className="page-title">{greeting}</div>
        <div style={{ color: 'var(--text3)', marginTop: 12 }}>Loading...</div>
      </div>
    )
  }

  return (
    <div className="page">
      {/* Greeting */}
      <div className="page-title" style={{ marginBottom: 4 }}>{greeting}</div>
      <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 20 }}>
        今日はどんな日でしたか?
      </p>

      {/* Quick entry */}
      <Card style={{ marginBottom: 20 }}>
        <textarea
          className="input"
          placeholder="思ったこと、感じたことを自由に..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ minHeight: 80, width: '100%', boxSizing: 'border-box', marginBottom: 8 }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>
            {saving ? '保存中...' : saved ? '保存しました' : analyzing ? '感情分析中...' : ''}
          </span>
          <button
            className="btn btn-p btn-sm"
            onClick={() => saveEntry(text)}
            disabled={!text.trim() || saving || analyzing}
          >
            {analyzing ? '分析中...' : '記録する'}
          </button>
        </div>
        {emotionError && (
          <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>
            {emotionError}
          </div>
        )}
      </Card>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        {streak > 0 && (
          <div style={{ fontSize: 13, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: '#ff6b35', fontWeight: 600 }}>{streak}</span>日連続
          </div>
        )}
        {wbi !== null && (
          <div style={{ fontSize: 13, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 4 }}>
            WBI <span style={{ fontWeight: 600, fontFamily: 'var(--mono)' }}>{wbi.toFixed(1)}</span>
          </div>
        )}
      </div>

      {/* AI Morning Briefing */}
      <Card style={{ marginBottom: 24, background: 'var(--accent-bg)', border: '1px solid var(--accent-border)' }}>
        <div style={{ fontSize: 11, color: 'var(--accent2)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.08em' }}>
          AI の一言
        </div>
        {briefingLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              border: '2px solid var(--accent2)',
              borderTopColor: 'transparent',
              animation: 'spin 1s linear infinite',
            }} />
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>考え中...</span>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, fontStyle: 'italic' }}>
            {briefingMessage || '今日も穏やかに過ごせますように。'}
          </div>
        )}
      </Card>

      {/* Today's fragments */}
      {fragments.length > 0 && (
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
                      <span
                        key={b.key}
                        style={{
                          fontSize: 9,
                          padding: '2px 6px',
                          borderRadius: 10,
                          background: b.color,
                          color: '#fff',
                          fontWeight: 600,
                          opacity: 0.85,
                        }}
                      >
                        {b.label} {b.value}
                      </span>
                    ))}
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Tasks */}
      {openTasks.length > 0 && (
        <div className="section">
          <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>タスク</span>
            <button
              className="btn btn-g btn-sm"
              style={{ textTransform: 'none', letterSpacing: 0, fontSize: 11 }}
              onClick={() => navigate('/tasks')}
            >
              すべて見る
            </button>
          </div>
          <Card>
            {openTasks.map((t) => (
              <div key={t.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.priority === 'high' ? 'var(--red)' : t.priority === 'low' ? 'var(--text3)' : 'var(--blue)', flexShrink: 0 }} />
                {t.title}
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Today's Habits */}
      {todayHabits.length > 0 && (
        <div className="section">
          <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>今日の習慣</span>
            <button
              className="btn btn-g btn-sm"
              style={{ textTransform: 'none', letterSpacing: 0, fontSize: 11 }}
              onClick={() => navigate('/habits')}
            >
              Habits
            </button>
          </div>
          <Card>
            {todayHabits.map((h) => (
              <div
                key={h.id}
                style={{
                  padding: '10px 0',
                  borderBottom: '1px solid var(--border)',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'pointer',
                }}
                onClick={() => toggleHabitLog(h, todayStr)}
              >
                <span style={{
                  width: 20,
                  height: 20,
                  borderRadius: 4,
                  border: `2px solid ${h.completed ? 'var(--green)' : 'var(--border)'}`,
                  background: h.completed ? 'var(--green)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  color: '#fff',
                  flexShrink: 0,
                }}>
                  {h.completed ? '✓' : ''}
                </span>
                <span style={{
                  color: h.completed ? 'var(--text3)' : 'var(--text)',
                  textDecoration: h.completed ? 'line-through' : 'none',
                  fontWeight: 500,
                }}>
                  {h.icon} {h.title}
                </span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Dreams */}
      <div className="section">
        <div className="section-title">夢への一歩</div>
        <Card
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('/dreams')}
        >
          {dreamsCount > 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>
              <span style={{ fontWeight: 600, color: 'var(--accent2)', fontFamily: 'var(--mono)' }}>{dreamsCount}</span>
              {' '}個の夢が進行中
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>
              夢リストを作成して、理想の未来を描きましょう
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
