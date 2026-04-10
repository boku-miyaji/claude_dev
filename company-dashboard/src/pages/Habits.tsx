import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, PageHeader, Modal, toast } from '@/components/ui'
import { HABIT_CATEGORIES, HABIT_ICONS, type HabitCategory, type HabitFrequency } from '@/types/habits'
import { useDataStore } from '@/stores/data'

/* ─── helpers ─── */

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getDaysInRange(start: Date, count: number): string[] {
  const days: string[] = []
  const d = new Date(start)
  for (let i = 0; i < count; i++) {
    days.push(formatDate(d))
    d.setDate(d.getDate() - 1)
  }
  return days
}

/** Check if a habit is applicable on a given date based on its frequency */
function isHabitApplicable(frequency: string, _dateStr: string): boolean {
  // daily / weekly / monthly — all applicable any day (user picks when)
  return frequency === 'daily' || frequency === 'weekly' || frequency === 'monthly'
}

/** Get the start date of the current period for a given frequency */
function getPeriodStart(frequency: string, dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  if (frequency === 'weekly') {
    const day = d.getDay()
    const diff = day === 0 ? 6 : day - 1 // Monday = start of week
    d.setDate(d.getDate() - diff)
  } else if (frequency === 'monthly') {
    d.setDate(1)
  }
  return formatDate(d)
}

/* ─── streak calculation ─── */

interface StreakInfo {
  current: number
  best: number
  nextMilestone: number
  daysToMilestone: number
}

const MILESTONES = [7, 14, 30, 50, 100, 200, 365]

function calcStreak(
  habits: { id: number; frequency: string }[],
  habitLogs: { habit_id: number; completed_at: string }[],
  todayStr: string,
): StreakInfo {
  if (habits.length === 0) return { current: 0, best: 0, nextMilestone: 7, daysToMilestone: 7 }

  // Build day → completed habit ids map
  const dayMap = new Map<string, Set<number>>()
  for (const log of habitLogs) {
    const day = log.completed_at.substring(0, 10)
    if (!dayMap.has(day)) dayMap.set(day, new Set())
    dayMap.get(day)!.add(log.habit_id)
  }

  // Walk backwards from today (or yesterday if today has no data yet)
  const days = getDaysInRange(new Date(todayStr + 'T00:00:00'), 400) // up to ~1 year back
  let current = 0
  let best = 0
  let streak = 0
  let streakBroken = false

  for (let i = 0; i < days.length; i++) {
    const day = days[i]
    const applicableHabits = habits.filter((h) => isHabitApplicable(h.frequency, day))
    if (applicableHabits.length === 0) {
      // No habits apply (e.g., weekend for weekday-only habits) — continue streak
      if (!streakBroken) current = streak
      continue
    }

    const completed = dayMap.get(day) ?? new Set()
    const completedCount = applicableHabits.filter((h) => completed.has(h.id)).length
    const rate = completedCount / applicableHabits.length

    if (rate >= 0.5) {
      streak++
      if (!streakBroken) current = streak
      best = Math.max(best, streak)
    } else {
      // Today is special — if it's the first day and nothing done yet, don't break
      if (i === 0) {
        // Today: user might not have done habits yet. Check yesterday
        continue
      }
      if (!streakBroken) {
        streakBroken = true
      }
      streak = 0
    }
  }

  best = Math.max(best, current)

  const nextMilestone = MILESTONES.find((m) => m > current) ?? current + 50
  const daysToMilestone = nextMilestone - current

  return { current, best, nextMilestone, daysToMilestone }
}

/** Calculate streak for a single habit */
function calcHabitStreak(
  habitId: number,
  frequency: string,
  habitLogs: { habit_id: number; completed_at: string }[],
  todayStr: string,
): number {
  const logs = habitLogs.filter((l) => l.habit_id === habitId)
  const logDays = new Set(logs.map((l) => l.completed_at.substring(0, 10)))
  const days = getDaysInRange(new Date(todayStr + 'T00:00:00'), 120)
  let streak = 0

  for (let i = 0; i < days.length; i++) {
    const day = days[i]
    if (!isHabitApplicable(frequency, day)) continue
    if (i === 0 && !logDays.has(day)) continue // Today: hasn't done yet, skip
    if (logDays.has(day)) {
      streak++
    } else {
      break
    }
  }
  return streak
}

/* ─── SVG Progress Ring ─── */

function ProgressRing({ completed, total, size = 80 }: { completed: number; total: number; size?: number }) {
  const strokeWidth = 6
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = total > 0 ? completed / total : 0
  const offset = circumference * (1 - progress)
  const isPerfect = completed >= total && total > 0

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--surface2)" strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={isPerfect ? 'var(--green)' : 'var(--accent)'}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          fontFamily: 'var(--mono)', fontWeight: 700,
          fontSize: size > 70 ? 20 : 16,
          color: isPerfect ? 'var(--green)' : 'var(--text)',
          letterSpacing: '-.02em',
        }}>
          {completed}/{total}
        </div>
      </div>
    </div>
  )
}

/* ─── Milestone Bar ─── */

function MilestoneBar({ current, milestones }: { current: number; milestones: number[] }) {
  const relevant = milestones.filter((m) => m <= current * 3 || m <= milestones[2])
  const max = relevant[relevant.length - 1] || milestones[0]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, position: 'relative', height: 24, marginTop: 8 }}>
      <div style={{
        position: 'absolute', left: 0, right: 0, top: '50%', height: 3,
        background: 'var(--surface2)', borderRadius: 2, transform: 'translateY(-50%)',
      }} />
      <div style={{
        position: 'absolute', left: 0, top: '50%', height: 3,
        width: `${Math.min((current / max) * 100, 100)}%`,
        background: 'var(--green)', borderRadius: 2, transform: 'translateY(-50%)',
        transition: 'width 0.6s ease',
      }} />
      {relevant.map((m) => {
        const reached = current >= m
        const pos = (m / max) * 100
        return (
          <div key={m} style={{
            position: 'absolute', left: `${Math.min(pos, 100)}%`,
            transform: 'translateX(-50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: reached ? 'var(--green)' : 'var(--surface2)',
              border: `2px solid ${reached ? 'var(--green)' : 'var(--border)'}`,
            }} />
            <div style={{
              fontSize: 9, color: reached ? 'var(--green)' : 'var(--text3)',
              fontFamily: 'var(--mono)', fontWeight: 500, marginTop: 2,
            }}>
              {m}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ─── Main Component ─── */

export function Habits() {
  const {
    habits, habitLogs,
    fetchHabits, fetchHabitLogs,
    addHabit, updateHabit, deleteHabit, toggleHabitLog,
    loading,
  } = useDataStore()

  const [showAdd, setShowAdd] = useState(false)
  const [editHabitId, setEditHabitId] = useState<number | null>(null)
  const [expandedHabitId, setExpandedHabitId] = useState<number | null>(null)

  // Add/edit form state
  const [formTitle, setFormTitle] = useState('')
  const [formCategory, setFormCategory] = useState<HabitCategory>('life')
  const [formFrequency, setFormFrequency] = useState<HabitFrequency>('daily')
  const [formIcon, setFormIcon] = useState('\u2705')
  const [formTarget, setFormTarget] = useState(1)
  const [saving, setSaving] = useState(false)

  const todayStr = useMemo(() => formatDate(new Date()), [])

  useEffect(() => {
    fetchHabits()
    fetchHabitLogs({ days: 60 })
  }, [fetchHabits, fetchHabitLogs])

  const editHabit = useMemo(() => {
    if (editHabitId === null) return null
    return habits.find((h) => h.id === editHabitId) ?? null
  }, [editHabitId, habits])

  /** Get completion count for a habit in the current period (day/week/month) */
  const getPeriodCount = useCallback((habitId: number, frequency: string): number => {
    const periodStart = getPeriodStart(frequency, todayStr)
    return habitLogs.filter(
      (l) => l.habit_id === habitId && l.completed_at.substring(0, 10) >= periodStart && l.completed_at.substring(0, 10) <= todayStr,
    ).length
  }, [habitLogs, todayStr])

  /** Toggle today's habit completion */
  const handleToggle = useCallback(async (habitId: number) => {
    const habit = habits.find((h) => h.id === habitId)
    if (!habit) return
    const wasDoneToday = habitLogs.some(
      (l) => l.habit_id === habitId && l.completed_at.substring(0, 10) === todayStr,
    )
    await toggleHabitLog(habit, todayStr)
    if (!wasDoneToday) {
      toast(`${habit.icon} ${habit.title} done!`)
    } else {
      toast('Undone')
    }
  }, [habits, habitLogs, toggleHabitLog, todayStr])

  /* ─── Computed data ─── */

  /** Overall streak */
  const streakInfo = useMemo(() =>
    calcStreak(
      habits.map((h) => ({ id: h.id, frequency: h.frequency })),
      habitLogs,
      todayStr,
    ),
  [habits, habitLogs, todayStr])

  /** Per-habit streaks */
  const habitStreaks = useMemo(() => {
    const map = new Map<number, number>()
    for (const h of habits) {
      map.set(h.id, calcHabitStreak(h.id, h.frequency, habitLogs, todayStr))
    }
    return map
  }, [habits, habitLogs, todayStr])

  /** Today's overall completion */
  const todayStats = useMemo(() => {
    const applicable = habits.filter((h) => isHabitApplicable(h.frequency, todayStr))
    const completedIds = new Set(
      habitLogs
        .filter((l) => l.completed_at.substring(0, 10) === todayStr)
        .map((l) => l.habit_id),
    )
    const done = applicable.filter((h) => completedIds.has(h.id)).length
    return { done, total: applicable.length }
  }, [habits, habitLogs, todayStr])

  /** Weekly insight data */
  const weeklyInsight = useMemo(() => {
    if (habits.length === 0) return null

    const thisWeekDays = getDaysInRange(new Date(), 7)
    const lastWeekStart = new Date()
    lastWeekStart.setDate(lastWeekStart.getDate() - 7)
    const lastWeekDays = getDaysInRange(lastWeekStart, 7)

    const calcWeekRate = (days: string[]) => {
      let totalApplicable = 0
      let totalDone = 0
      for (const day of days) {
        const applicable = habits.filter((h) => isHabitApplicable(h.frequency, day))
        totalApplicable += applicable.length
        const doneIds = new Set(
          habitLogs.filter((l) => l.completed_at.substring(0, 10) === day).map((l) => l.habit_id),
        )
        totalDone += applicable.filter((h) => doneIds.has(h.id)).length
      }
      return totalApplicable > 0 ? Math.round((totalDone / totalApplicable) * 100) : 0
    }

    const thisWeekRate = calcWeekRate(thisWeekDays)
    const lastWeekRate = calcWeekRate(lastWeekDays)

    // Per-habit rates this week
    const habitRates = habits.map((h) => {
      let applicable = 0
      let done = 0
      for (const day of thisWeekDays) {
        if (!isHabitApplicable(h.frequency, day)) continue
        applicable++
        const count = habitLogs.filter(
          (l) => l.habit_id === h.id && l.completed_at.substring(0, 10) === day,
        ).length
        if (count > 0) done++
      }
      return { habit: h, rate: applicable > 0 ? Math.round((done / applicable) * 100) : 0 }
    }).sort((a, b) => a.rate - b.rate)

    const weakest = habitRates[0]?.rate < 50 ? habitRates[0] : null
    const strongest = habitRates[habitRates.length - 1]

    return { thisWeekRate, lastWeekRate, weakest, strongest, habitRates }
  }, [habits, habitLogs])

  /** 60-day heatmap data */
  const heatmapData = useMemo(() => {
    const days = getDaysInRange(new Date(), 60)
    const map = new Map<string, number>()
    for (const day of days) {
      const applicable = habits.filter((h) => isHabitApplicable(h.frequency, day))
      if (applicable.length === 0) {
        map.set(day, -1) // not applicable
        continue
      }
      const completedIds = new Set(
        habitLogs.filter((l) => l.completed_at.substring(0, 10) === day).map((l) => l.habit_id),
      )
      const done = applicable.filter((h) => completedIds.has(h.id)).length
      map.set(day, done / applicable.length)
    }
    return { days: [...days].reverse(), map }
  }, [habits, habitLogs])

  /** Per-habit 30-day data (for inline expansion) */
  const getHabitDayData = useCallback((habitId: number) => {
    const days = getDaysInRange(new Date(), 30)
    return [...days].reverse().map((day) => {
      const count = habitLogs.filter(
        (l) => l.habit_id === habitId && l.completed_at.substring(0, 10) === day,
      ).length
      return { day, done: count > 0 }
    })
  }, [habitLogs])

  /** Per-habit monthly rates */
  const getHabitMonthlyRates = useCallback((habitId: number, frequency: string) => {
    const now = new Date()
    const thisMonthDays = getDaysInRange(now, now.getDate())
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
    const lastMonthDays = getDaysInRange(lastMonthEnd, lastMonthEnd.getDate())

    const calcRate = (days: string[]) => {
      let applicable = 0
      let done = 0
      for (const day of days) {
        if (!isHabitApplicable(frequency, day)) continue
        applicable++
        const count = habitLogs.filter(
          (l) => l.habit_id === habitId && l.completed_at.substring(0, 10) === day,
        ).length
        if (count > 0) done++
      }
      return applicable > 0 ? Math.round((done / applicable) * 100) : 0
    }

    return { thisMonth: calcRate(thisMonthDays), lastMonth: calcRate(lastMonthDays) }
  }, [habitLogs])

  /* ─── Modal helpers ─── */

  const openAdd = useCallback(() => {
    setFormTitle('')
    setFormCategory('life')
    setFormFrequency('daily')
    setFormIcon('\u2705')
    setFormTarget(1)
    setEditHabitId(null)
    setShowAdd(true)
  }, [])

  const openEdit = useCallback((habitId: number) => {
    const habit = habits.find((h) => h.id === habitId)
    if (!habit) return
    setFormTitle(habit.title)
    setFormCategory(habit.category)
    setFormFrequency(habit.frequency)
    setFormIcon(habit.icon)
    setFormTarget(habit.target_count)
    setEditHabitId(habitId)
    setShowAdd(true)
  }, [habits])

  const saveHabit = useCallback(async () => {
    if (!formTitle.trim()) return
    setSaving(true)

    if (editHabit) {
      await updateHabit(editHabit.id, {
        title: formTitle.trim(),
        category: formCategory,
        frequency: formFrequency,
        icon: formIcon,
        target_count: formTarget,
      })
      toast('Updated')
      setShowAdd(false)
    } else {
      await addHabit({
        title: formTitle.trim(),
        category: formCategory,
        frequency: formFrequency,
        icon: formIcon,
        target_count: formTarget,
      })
      toast('Habit added')
      setShowAdd(false)
    }
    setSaving(false)
  }, [formTitle, formCategory, formFrequency, formIcon, formTarget, editHabit, updateHabit, addHabit])

  const handleDeleteHabit = useCallback(async () => {
    if (!editHabit) return
    await deleteHabit(editHabit.id)
    toast('Deleted')
    setShowAdd(false)
  }, [editHabit, deleteHabit])

  const isLoading = loading.habits || loading.habitLogs

  if (isLoading && habits.length === 0) {
    return (
      <div className="page">
        <PageHeader title="Habits" />
        <div style={{ color: 'var(--text3)' }}>Loading...</div>
      </div>
    )
  }

  const isPerfectToday = todayStats.done >= todayStats.total && todayStats.total > 0

  return (
    <div className="page">
      <PageHeader title="Habits" description="Small steps, big changes" />

      {/* ─── [A] Hero: Streak + Today Progress ─── */}
      {habits.length > 0 && (
        <Card style={{
          marginBottom: 20,
          background: isPerfectToday
            ? 'linear-gradient(135deg, var(--green-bg), var(--surface))'
            : undefined,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {/* Progress Ring */}
            <ProgressRing completed={todayStats.done} total={todayStats.total} size={76} />

            {/* Streak Info */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{
                  fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 28,
                  color: streakInfo.current > 0 ? 'var(--green)' : 'var(--text3)',
                  letterSpacing: '-.03em',
                }}>
                  {streakInfo.current}
                </span>
                <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500 }}>
                  days streak
                </span>
              </div>
              {streakInfo.best > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                  Best: {streakInfo.best} days
                </div>
              )}
              {streakInfo.current > 0 && streakInfo.daysToMilestone > 0 && (
                <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 2, fontWeight: 500 }}>
                  {streakInfo.daysToMilestone} more to {streakInfo.nextMilestone} days
                </div>
              )}
              {streakInfo.current === 0 && streakInfo.best > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                  {streakInfo.best} days was great. Let's start again.
                </div>
              )}

              {/* Today remaining */}
              {!isPerfectToday && todayStats.total > 0 && (
                <div style={{
                  fontSize: 11, color: 'var(--text2)', marginTop: 6,
                  background: 'var(--surface2)', borderRadius: 4, padding: '3px 8px',
                  display: 'inline-block',
                }}>
                  {todayStats.total - todayStats.done} remaining today
                </div>
              )}
              {isPerfectToday && (
                <div style={{
                  fontSize: 11, color: 'var(--green)', marginTop: 6,
                  fontWeight: 600,
                }}>
                  Today: Perfect
                </div>
              )}
            </div>
          </div>

          {/* Milestone Bar */}
          {streakInfo.current > 0 && (
            <MilestoneBar current={streakInfo.current} milestones={MILESTONES} />
          )}
        </Card>
      )}

      {/* ─── [B] Today's Habits ─── */}
      <div className="section">
        <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Today</span>
          <button className="btn btn-g btn-sm" onClick={openAdd}>+ Add</button>
        </div>

        {habits.length === 0 ? (
          <Card>
            <div style={{ textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🌱</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>
                No habits yet
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
                Start with something small
              </div>
              <button className="btn btn-p btn-sm" onClick={openAdd}>Add first habit</button>
            </div>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {habits.map((habit) => {
              const periodCount = getPeriodCount(habit.id, habit.frequency)
              const completed = periodCount >= habit.target_count
              const doneToday = habitLogs.some(
                (l) => l.habit_id === habit.id && l.completed_at.substring(0, 10) === todayStr,
              )
              const streak = habitStreaks.get(habit.id) ?? 0
              const isExpanded = expandedHabitId === habit.id

              return (
                <div key={habit.id}>
                  <Card style={{
                    cursor: 'pointer',
                    borderLeft: completed ? '3px solid var(--green)' : '3px solid transparent',
                    transition: 'border-color 0.2s',
                  }}>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                      onClick={() => handleToggle(habit.id)}
                    >
                      {/* Checkbox */}
                      <div
                        style={{
                          width: 26, height: 26, borderRadius: 6,
                          border: `2px solid ${doneToday ? 'var(--green)' : 'var(--border)'}`,
                          background: doneToday ? 'var(--green)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, color: doneToday ? '#fff' : 'var(--text3)',
                          transition: 'all .2s', flexShrink: 0,
                        }}
                      >
                        {doneToday ? '\u2713' : ''}
                      </div>

                      {/* Title + count */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 13, fontWeight: 500,
                          color: 'var(--text)',
                        }}>
                          {habit.icon} {habit.title}
                          {completed && <span style={{ fontSize: 10, color: 'var(--green)', marginLeft: 6, fontWeight: 600 }}>達成</span>}
                        </div>
                        <div style={{ fontSize: 10, color: completed ? 'var(--green)' : 'var(--text3)', marginTop: 1 }}>
                          {periodCount}/{habit.target_count}
                          {periodCount > habit.target_count && <span style={{ marginLeft: 4, color: 'var(--accent)' }}>+{periodCount - habit.target_count}</span>}
                        </div>
                      </div>

                      {/* Mini streak */}
                      {streak > 0 && (
                        <div
                          style={{
                            fontSize: 11, color: streak >= 7 ? 'var(--green)' : 'var(--text3)',
                            fontFamily: 'var(--mono)', fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: 2,
                            cursor: 'pointer', padding: '2px 6px',
                            background: streak >= 7 ? 'var(--green-bg)' : 'var(--surface2)',
                            borderRadius: 4,
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            setExpandedHabitId(isExpanded ? null : habit.id)
                          }}
                          title="Show details"
                        >
                          <span style={{ fontSize: 10 }}>🔥</span> {streak}
                        </div>
                      )}
                      {streak === 0 && (
                        <div
                          style={{
                            fontSize: 10, color: 'var(--text3)', cursor: 'pointer',
                            padding: '2px 6px',
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            setExpandedHabitId(isExpanded ? null : habit.id)
                          }}
                        >
                          ...
                        </div>
                      )}

                      {/* Edit */}
                      <button
                        className="btn btn-g btn-sm"
                        style={{ fontSize: 10, padding: '2px 8px' }}
                        onClick={(e) => { e.stopPropagation(); openEdit(habit.id) }}
                      >
                        edit
                      </button>
                    </div>
                  </Card>

                  {/* ─── Inline detail expansion ─── */}
                  {isExpanded && (
                    <div style={{
                      margin: '4px 0 8px 0', padding: '12px 14px',
                      background: 'var(--surface2)', borderRadius: 8,
                      fontSize: 12,
                    }}>
                      {/* 30-day mini heatmap (linear) */}
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6, fontWeight: 500 }}>
                          Last 30 days
                        </div>
                        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                          {getHabitDayData(habit.id).map(({ day, done }) => (
                            <div
                              key={day}
                              title={`${day}: ${done ? 'Done' : 'Missed'}`}
                              style={{
                                width: 12, height: 12, borderRadius: 2,
                                background: done ? 'var(--green)' : 'var(--surface)',
                                border: day === todayStr ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                              }}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Monthly rates */}
                      {(() => {
                        const rates = getHabitMonthlyRates(habit.id, habit.frequency)
                        const diff = rates.thisMonth - rates.lastMonth
                        return (
                          <div style={{ display: 'flex', gap: 16, color: 'var(--text2)' }}>
                            <div>
                              This month: <strong style={{ color: rates.thisMonth >= 70 ? 'var(--green)' : 'var(--text)' }}>
                                {rates.thisMonth}%
                              </strong>
                            </div>
                            <div>
                              Last month: <strong>{rates.lastMonth}%</strong>
                            </div>
                            {diff !== 0 && (
                              <div style={{
                                color: diff > 0 ? 'var(--green)' : 'var(--amber)',
                                fontWeight: 600,
                              }}>
                                {diff > 0 ? '\u2191' : '\u2193'}{Math.abs(diff)}%
                              </div>
                            )}
                          </div>
                        )
                      })()}

                      {/* Best streak */}
                      <div style={{ marginTop: 6, color: 'var(--text3)', fontSize: 11 }}>
                        Current streak: {streak} days
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── [C] Weekly Insight ─── */}
      {weeklyInsight && habits.length > 1 && (
        <div className="section">
          <div className="section-title">This Week</div>
          <Card>
            {/* Overall rate comparison */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
              <span style={{
                fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 24,
                color: weeklyInsight.thisWeekRate >= 70 ? 'var(--green)' : weeklyInsight.thisWeekRate >= 40 ? 'var(--amber)' : 'var(--text3)',
                letterSpacing: '-.02em',
              }}>
                {weeklyInsight.thisWeekRate}%
              </span>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                completion
              </span>
              {weeklyInsight.lastWeekRate > 0 && (
                <span style={{
                  fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 600,
                  color: weeklyInsight.thisWeekRate >= weeklyInsight.lastWeekRate ? 'var(--green)' : 'var(--amber)',
                }}>
                  {weeklyInsight.thisWeekRate >= weeklyInsight.lastWeekRate ? '\u2191' : '\u2193'}
                  {' '}vs {weeklyInsight.lastWeekRate}% last week
                </span>
              )}
            </div>

            {/* Progress bar */}
            <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden', marginBottom: 14 }}>
              <div style={{
                height: '100%',
                width: `${weeklyInsight.thisWeekRate}%`,
                background: weeklyInsight.thisWeekRate >= 70 ? 'var(--green)' : weeklyInsight.thisWeekRate >= 40 ? 'var(--amber)' : 'var(--accent)',
                borderRadius: 3, transition: 'width .4s',
              }} />
            </div>

            {/* Per-habit rates */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {weeklyInsight.habitRates.map(({ habit, rate }) => (
                <div key={habit.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text2)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {habit.icon} {habit.title}
                  </span>
                  <div style={{ width: 60, height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{
                      height: '100%', width: `${rate}%`,
                      background: rate >= 80 ? 'var(--green)' : rate >= 50 ? 'var(--amber)' : 'var(--accent)',
                      borderRadius: 2,
                    }} />
                  </div>
                  <span style={{
                    fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 600, width: 32, textAlign: 'right',
                    color: rate >= 80 ? 'var(--green)' : rate >= 50 ? 'var(--amber)' : 'var(--text3)',
                  }}>
                    {rate}%
                  </span>
                </div>
              ))}
            </div>

            {/* Nudge */}
            {weeklyInsight.weakest && (
              <div style={{
                marginTop: 12, padding: '8px 10px', borderRadius: 6,
                background: 'var(--amber-bg)', border: '1px solid var(--amber-border)',
                fontSize: 11, color: 'var(--text2)',
              }}>
                {weeklyInsight.weakest.habit.icon} <strong>{weeklyInsight.weakest.habit.title}</strong> is at {weeklyInsight.weakest.rate}% this week.
                {' '}Maybe adjust the frequency?
              </div>
            )}
            {weeklyInsight.strongest && weeklyInsight.strongest.rate === 100 && (
              <div style={{
                marginTop: weeklyInsight.weakest ? 6 : 12,
                padding: '8px 10px', borderRadius: 6,
                background: 'var(--green-bg)', border: '1px solid var(--green-border)',
                fontSize: 11, color: 'var(--text2)',
              }}>
                {weeklyInsight.strongest.habit.icon} <strong>{weeklyInsight.strongest.habit.title}</strong> — perfect this week!
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ─── [D] 60-day Heatmap ─── */}
      {habits.length > 0 && (
        <div className="section">
          <div className="section-title">60 Days</div>
          <Card>
            {/* Weekday labels + grid */}
            <div style={{ display: 'flex', gap: 2 }}>
              {/* Day labels */}
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 2,
                paddingTop: 18, // align with grid (month labels offset)
              }}>
                {['M', '', 'W', '', 'F', '', 'S'].map((label, i) => (
                  <div key={i} style={{
                    width: 14, height: 12, fontSize: 8,
                    color: 'var(--text3)', fontFamily: 'var(--mono)',
                    display: 'flex', alignItems: 'center',
                  }}>
                    {label}
                  </div>
                ))}
              </div>

              {/* Grid */}
              <div style={{ flex: 1, overflow: 'hidden' }}>
                {/* Month labels */}
                {(() => {
                  const days = heatmapData.days
                  // Group by weeks (columns)
                  const weeks: string[][] = []
                  let currentWeek: string[] = []

                  // Pad first week
                  if (days.length > 0) {
                    const firstDow = new Date(days[0] + 'T00:00:00').getDay()
                    // Monday = 0 in our grid
                    const mondayOffset = firstDow === 0 ? 6 : firstDow - 1
                    for (let i = 0; i < mondayOffset; i++) currentWeek.push('')
                  }

                  for (const day of days) {
                    currentWeek.push(day)
                    const dow = new Date(day + 'T00:00:00').getDay()
                    if (dow === 0) { // Sunday = end of week
                      weeks.push(currentWeek)
                      currentWeek = []
                    }
                  }
                  if (currentWeek.length > 0) {
                    while (currentWeek.length < 7) currentWeek.push('')
                    weeks.push(currentWeek)
                  }

                  // Month labels
                  const monthLabels: { label: string; col: number }[] = []
                  let lastMonth = ''
                  weeks.forEach((week, wi) => {
                    const firstDay = week.find((d) => d !== '')
                    if (firstDay) {
                      const m = firstDay.substring(0, 7)
                      if (m !== lastMonth) {
                        const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                        monthLabels.push({ label: monthNames[parseInt(firstDay.substring(5, 7))], col: wi })
                        lastMonth = m
                      }
                    }
                  })

                  return (
                    <>
                      {/* Month labels row */}
                      <div style={{ display: 'flex', gap: 2, marginBottom: 2, height: 14 }}>
                        {weeks.map((_, wi) => {
                          const ml = monthLabels.find((m) => m.col === wi)
                          return (
                            <div key={wi} style={{
                              width: 12, fontSize: 9, color: 'var(--text3)',
                              fontFamily: 'var(--mono)', flexShrink: 0,
                            }}>
                              {ml?.label ?? ''}
                            </div>
                          )
                        })}
                      </div>

                      {/* Grid rows (7 rows = Mon-Sun) */}
                      {[0, 1, 2, 3, 4, 5, 6].map((rowIdx) => (
                        <div key={rowIdx} style={{ display: 'flex', gap: 2, marginBottom: 2 }}>
                          {weeks.map((week, wi) => {
                            const day = week[rowIdx] ?? ''
                            if (!day) {
                              return <div key={wi} style={{ width: 12, height: 12, flexShrink: 0 }} />
                            }
                            const ratio = heatmapData.map.get(day) ?? 0
                            const isToday = day === todayStr
                            const notApplicable = ratio === -1

                            let bg = 'var(--surface2)'
                            if (!notApplicable) {
                              if (ratio >= 1) bg = 'var(--green)'
                              else if (ratio >= 0.5) bg = 'rgba(13, 159, 110, 0.5)'
                              else if (ratio > 0) bg = 'rgba(13, 159, 110, 0.25)'
                            }

                            return (
                              <div
                                key={wi}
                                title={notApplicable ? day : `${day}: ${Math.round(ratio * 100)}%`}
                                style={{
                                  width: 12, height: 12, borderRadius: 2,
                                  background: bg, flexShrink: 0,
                                  border: isToday ? '1.5px solid var(--accent)' : 'none',
                                  cursor: 'default',
                                }}
                              />
                            )
                          })}
                        </div>
                      ))}
                    </>
                  )
                })()}

                {/* Legend */}
                <div style={{
                  display: 'flex', gap: 4, alignItems: 'center',
                  marginTop: 8, fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)',
                }}>
                  <span>Less</span>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--surface2)' }} />
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(13, 159, 110, 0.25)' }} />
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(13, 159, 110, 0.5)' }} />
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--green)' }} />
                  <span>More</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ─── Add/Edit Modal ─── */}
      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title={editHabit ? 'Edit Habit' : 'Add Habit'}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', width: '100%' }}>
            {editHabit && (
              <button className="btn btn-d btn-sm" onClick={handleDeleteHabit}>Delete</button>
            )}
            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
              <button className="btn btn-g btn-sm" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-p btn-sm" onClick={saveHabit} disabled={!formTitle.trim() || saving}>
                {saving ? 'Saving...' : editHabit ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Title</label>
            <input
              className="input"
              style={{ width: '100%', boxSizing: 'border-box' }}
              placeholder="e.g., Morning walk"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Icon</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {HABIT_ICONS.map((icon) => (
                <button
                  key={icon}
                  onClick={() => setFormIcon(icon)}
                  style={{
                    width: 36, height: 36, borderRadius: 8,
                    border: formIcon === icon ? '2px solid var(--accent)' : '1px solid var(--border)',
                    background: formIcon === icon ? 'var(--accent-bg)' : 'transparent',
                    fontSize: 18, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Category</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {HABIT_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setFormCategory(cat.value)}
                  className={`btn ${formCategory === cat.value ? 'btn-p' : 'btn-g'} btn-sm`}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Frequency</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { value: 'daily' as const, label: 'Daily' },
                { value: 'weekly' as const, label: 'Weekly' },
                { value: 'monthly' as const, label: 'Monthly' },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFormFrequency(f.value)}
                  className={`btn ${formFrequency === f.value ? 'btn-p' : 'btn-g'} btn-sm`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Target / {{ daily: 'day', weekly: 'week', monthly: 'month' }[formFrequency]}</label>
            <input
              className="input"
              type="number"
              min={1}
              max={10}
              style={{ width: 80 }}
              value={formTarget}
              onChange={(e) => setFormTarget(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
