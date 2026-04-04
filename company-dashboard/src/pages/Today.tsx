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
import { getTimeMode, getGreeting, formatToday, getDiaryPrompt } from '@/lib/timeMode'
import type { TimeMode } from '@/lib/timeMode'
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

interface EmotionBadge {
  key: string
  label: string
  color: string
  value: number
}

function formatEventTime(iso: string): string {
  if (!iso.includes('T')) return '終日'
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tokyo' })
}

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

  // Build schedule text for AI context
  const todayEventsText = useMemo(() => {
    if (todayEvents.length === 0) return undefined
    return todayEvents.map((e) => `${formatEventTime(e.start)} ${e.summary}${e.isPast ? ' (完了)' : ''}`).join('\n')
  }, [todayEvents])

  const tomorrowEventsText = useMemo(() => {
    if (tomorrowEvents.length === 0) return undefined
    return tomorrowEvents.map((e) => `${formatEventTime(e.start)} ${e.summary}`).join('\n')
  }, [tomorrowEvents])

  const { message: briefingMessage, loading: briefingLoading } = useMorningBriefing(
    timeMode,
    todayEventsText,
    tomorrowEventsText,
  )

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

  // Tasks
  const openTasks = useMemo(() => tasks.filter((t) => t.status === 'open').slice(0, 5), [tasks])
  const completedToday = useMemo(() => {
    return tasks.filter((t) => t.status === 'done' && t.completed_at?.substring(0, 10) === todayStr)
  }, [tasks, todayStr])
  const dueTodayTasks = useMemo(() => {
    return openTasks.filter((t) => t.due_date === todayStr)
  }, [openTasks, todayStr])
  const focusTasks = useMemo(() => {
    // Due today + high priority, max 3
    const high = openTasks.filter((t) => t.priority === 'high')
    const combined = [...dueTodayTasks, ...high.filter((t) => !dueTodayTasks.includes(t))]
    return combined.slice(0, 3)
  }, [openTasks, dueTodayTasks])

  // Dreams count
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

  const habitsCompleted = todayHabits.filter((h) => h.completed).length

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

      // Dream detection in background
      detect(content.trim()).then((detections) => {
        for (const d of detections) {
          toast(`夢『${d.dream_title}』に近づいているかもしれません！`)
        }
      })
    }
  }, [addDiaryEntry, analyze, detect, todayStr])

  const diaryPrompt = useMemo(() => getDiaryPrompt(timeMode, recentEventName ?? undefined), [timeMode, recentEventName])

  const isLoading = loading.diary || loading.tasks || loading.dreams

  if (isLoading && fragments.length === 0) {
    return (
      <div className="page">
        <div className="page-title">{getGreeting(timeMode)}</div>
        <div style={{ color: 'var(--text3)', marginTop: 12 }}>Loading...</div>
      </div>
    )
  }

  // ========== Shared UI sections ==========

  const GreetingSection = (
    <div style={{ marginBottom: 20 }}>
      <div className="page-title" style={{ marginBottom: 4 }}>{getGreeting(timeMode)}</div>
      <div style={{ fontSize: 13, color: 'var(--text2)' }}>
        {formatToday()}
        {weather && (
          <span style={{ marginLeft: 8 }}>
            {weather.icon} {weather.tempMax}℃ / {weather.tempMin}℃
          </span>
        )}
      </div>
    </div>
  )

  const ScheduleSection = todayEvents.length > 0 ? (
    <div className="section">
      <div className="section-title">
        {timeMode === 'afternoon' ? 'この後の予定' : '今日のスケジュール'}
      </div>
      <Card>
        {(timeMode === 'afternoon' ? todayEvents.filter((e) => !e.isPast) : todayEvents).map((e) => (
          <div
            key={e.id}
            style={{
              padding: '8px 0',
              borderBottom: '1px solid var(--border)',
              fontSize: 13,
              display: 'flex',
              gap: 10,
              opacity: e.isPast ? 0.5 : 1,
            }}
          >
            <span style={{ fontWeight: 600, fontFamily: 'var(--mono)', color: 'var(--text2)', minWidth: 42 }}>
              {formatEventTime(e.start)}
            </span>
            <span style={{ color: 'var(--text)', textDecoration: e.isPast ? 'line-through' : 'none' }}>
              {e.summary}
            </span>
          </div>
        ))}
      </Card>
    </div>
  ) : null

  const TomorrowSection = tomorrowEvents.length > 0 ? (
    <div className="section">
      <div className="section-title">明日の予定</div>
      <Card>
        {tomorrowEvents.slice(0, 3).map((e) => (
          <div key={e.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13, display: 'flex', gap: 10 }}>
            <span style={{ fontWeight: 600, fontFamily: 'var(--mono)', color: 'var(--text2)', minWidth: 42 }}>
              {formatEventTime(e.start)}
            </span>
            <span style={{ color: 'var(--text)' }}>{e.summary}</span>
          </div>
        ))}
        {tomorrowEvents.length > 3 && (
          <div style={{ padding: '6px 0', fontSize: 11, color: 'var(--text3)' }}>他 {tomorrowEvents.length - 3}件</div>
        )}
      </Card>
    </div>
  ) : (
    timeMode === 'evening' ? (
      <div className="section">
        <div className="section-title">明日の予定</div>
        <Card><div style={{ fontSize: 13, color: 'var(--text3)', padding: 4 }}>明日はフリーです</div></Card>
      </div>
    ) : null
  )

  const BriefingSection = (
    <Card style={{ marginBottom: 16, background: 'var(--accent-bg)', border: '1px solid var(--accent-border)' }}>
      <div style={{ fontSize: 11, color: 'var(--accent2)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.08em' }}>
        AI Partner
      </div>
      {briefingLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 12, height: 12, borderRadius: '50%',
            border: '2px solid var(--accent2)', borderTopColor: 'transparent',
            animation: 'spin 1s linear infinite',
          }} />
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>考え中...</span>
        </div>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
          {briefingMessage || '今日も穏やかに過ごせますように。'}
        </div>
      )}
    </Card>
  )

  const DiaryInput = (
    <Card style={{ marginBottom: 16 }}>
      <textarea
        className="input"
        placeholder={diaryPrompt}
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{
          minHeight: timeMode === 'evening' ? 100 : 44,
          width: '100%',
          boxSizing: 'border-box',
          marginBottom: 8,
        }}
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
        <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{emotionError}</div>
      )}
    </Card>
  )

  const FocusTasksSection = focusTasks.length > 0 ? (
    <div className="section">
      <div className="section-title">今日のフォーカス</div>
      <Card>
        {focusTasks.map((t) => (
          <div key={t.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.priority === 'high' ? 'var(--red)' : 'var(--blue)', flexShrink: 0 }} />
            {t.title}
            {t.due_date === todayStr && <span style={{ fontSize: 10, color: 'var(--red)', marginLeft: 'auto' }}>期限今日</span>}
          </div>
        ))}
      </Card>
    </div>
  ) : null

  const RemainingTasksSection = openTasks.length > 0 ? (
    <div className="section">
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>残りのタスク</span>
        <button className="btn btn-g btn-sm" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 11 }} onClick={() => navigate('/tasks')}>すべて見る</button>
      </div>
      <Card>
        {openTasks.map((t) => (
          <div key={t.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.priority === 'high' ? 'var(--red)' : t.priority === 'low' ? 'var(--text3)' : 'var(--blue)', flexShrink: 0 }} />
            {t.title}
          </div>
        ))}
      </Card>
    </div>
  ) : null

  const CompletedTasksSection = completedToday.length > 0 ? (
    <div className="section">
      <div className="section-title">完了したタスク</div>
      <Card>
        {completedToday.map((t) => (
          <div key={t.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--green)' }}>✓</span>
            <span style={{ textDecoration: 'line-through' }}>{t.title}</span>
          </div>
        ))}
      </Card>
    </div>
  ) : null

  const CarryoverSection = openTasks.length > 0 && timeMode === 'evening' ? (
    <div className="section">
      <div className="section-title">明日に持ち越す?</div>
      <Card>
        {openTasks.slice(0, 3).map((t) => (
          <div key={t.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--text3)' }}>○</span> {t.title}
          </div>
        ))}
      </Card>
    </div>
  ) : null

  const HabitsSection = todayHabits.length > 0 ? (
    <div className="section">
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>今日の習慣</span>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{habitsCompleted}/{todayHabits.length} 完了</span>
      </div>
      <Card>
        {todayHabits.map((h) => (
          <div
            key={h.id}
            style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
            onClick={() => toggleHabitLog(h, todayStr)}
          >
            <span style={{
              width: 20, height: 20, borderRadius: 4,
              border: `2px solid ${h.completed ? 'var(--green)' : 'var(--border)'}`,
              background: h.completed ? 'var(--green)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, color: '#fff', flexShrink: 0,
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
  ) : null

  const FragmentsSection = fragments.length > 0 ? (
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

  const SummarySection = (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: 'var(--text2)' }}>
        <span>タスク <strong style={{ color: 'var(--green)' }}>{completedToday.length}</strong>/{completedToday.length + openTasks.length} 完了</span>
        <span>習慣 <strong style={{ color: 'var(--green)' }}>{habitsCompleted}</strong>/{todayHabits.length} 完了</span>
        {fragments.length > 0 && <span>断片 <strong>{fragments.length}</strong>件</span>}
        {streak > 0 && <span style={{ color: '#ff6b35' }}>{streak}日連続</span>}
        {wbi !== null && <span>WBI <strong style={{ fontFamily: 'var(--mono)' }}>{wbi.toFixed(1)}</strong></span>}
      </div>
    </Card>
  )

  const DreamsSection = dreamsCount > 0 ? (
    <div className="section">
      <div className="section-title">夢への一歩</div>
      <Card style={{ cursor: 'pointer' }} onClick={() => navigate('/dreams')}>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          <span style={{ fontWeight: 600, color: 'var(--accent2)', fontFamily: 'var(--mono)' }}>{dreamsCount}</span> 個の夢が進行中
        </div>
      </Card>
    </div>
  ) : null

  const StreakSection = streak > 0 ? (
    <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: '#ff6b35', fontWeight: 600 }}>{streak}</span>日連続記録
      {wbi !== null && <span style={{ marginLeft: 12 }}>WBI <span style={{ fontWeight: 600, fontFamily: 'var(--mono)' }}>{wbi.toFixed(1)}</span></span>}
    </div>
  ) : null

  // ========== Time-adaptive layout ==========

  if (timeMode === 'morning') {
    return (
      <div className="page">
        {GreetingSection}
        {ScheduleSection}
        {BriefingSection}
        {FocusTasksSection}
        {HabitsSection}
        {DiaryInput}
        {StreakSection}
        {FragmentsSection}
        {DreamsSection}
      </div>
    )
  }

  if (timeMode === 'afternoon') {
    return (
      <div className="page">
        {GreetingSection}
        {DiaryInput}
        {ScheduleSection}
        {RemainingTasksSection}
        {FragmentsSection}
        {HabitsSection}
        {BriefingSection}
      </div>
    )
  }

  // evening
  return (
    <div className="page">
      {GreetingSection}
      {SummarySection}
      {DiaryInput}
      {BriefingSection}
      {FragmentsSection}
      {CompletedTasksSection}
      {CarryoverSection}
      {TomorrowSection}
      {DreamsSection}
    </div>
  )
}
