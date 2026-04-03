import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, PageHeader, Modal, toast } from '@/components/ui'
import { HABIT_CATEGORIES, HABIT_ICONS, type Habit, type HabitLog, type HabitCategory, type HabitFrequency } from '@/types/habits'

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

export function Habits() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [logs, setLogs] = useState<HabitLog[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editHabit, setEditHabit] = useState<Habit | null>(null)

  // Add/edit form state
  const [formTitle, setFormTitle] = useState('')
  const [formCategory, setFormCategory] = useState<HabitCategory>('life')
  const [formFrequency, setFormFrequency] = useState<HabitFrequency>('daily')
  const [formIcon, setFormIcon] = useState('✅')
  const [formTarget, setFormTarget] = useState(1)
  const [saving, setSaving] = useState(false)

  const todayStr = useMemo(() => formatDate(new Date()), [])

  const load = useCallback(async () => {
    setLoading(true)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [habitsRes, logsRes] = await Promise.all([
      supabase
        .from('habits')
        .select('*')
        .eq('active', true)
        .order('created_at'),
      supabase
        .from('habit_logs')
        .select('*')
        .gte('completed_at', `${formatDate(thirtyDaysAgo)}T00:00:00`)
        .order('completed_at', { ascending: false }),
    ])

    setHabits((habitsRes.data as Habit[]) ?? [])
    setLogs((logsRes.data as HabitLog[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  /** Get today's completion count for a habit */
  const getTodayCount = useCallback((habitId: number): number => {
    return logs.filter(
      (l) => l.habit_id === habitId && l.completed_at.substring(0, 10) === todayStr,
    ).length
  }, [logs, todayStr])

  /** Toggle today's habit completion */
  const toggleHabit = useCallback(async (habit: Habit) => {
    const todayCount = getTodayCount(habit.id)
    if (todayCount >= habit.target_count) {
      // Uncomplete: remove last log for today
      const todayLog = logs.find(
        (l) => l.habit_id === habit.id && l.completed_at.substring(0, 10) === todayStr,
      )
      if (todayLog) {
        await supabase.from('habit_logs').delete().eq('id', todayLog.id)
        setLogs((prev) => prev.filter((l) => l.id !== todayLog.id))
        toast('取り消しました')
      }
    } else {
      // Complete: add log
      const { data } = await supabase
        .from('habit_logs')
        .insert({ habit_id: habit.id })
        .select()
        .single()
      if (data) {
        setLogs((prev) => [data as HabitLog, ...prev])
        toast(`${habit.icon} ${habit.title} 完了！`)
      }
    }
  }, [getTodayCount, logs, todayStr])

  /** Week achievement rate for a habit */
  const getWeekRate = useCallback((habitId: number): number => {
    const days = getDaysInRange(new Date(), 7)
    let completed = 0
    for (const day of days) {
      const count = logs.filter(
        (l) => l.habit_id === habitId && l.completed_at.substring(0, 10) === day,
      ).length
      if (count > 0) completed++
    }
    return Math.round((completed / 7) * 100)
  }, [logs])

  /** 30-day calendar data: date -> completion ratio (0-1) */
  const calendarData = useMemo(() => {
    const days = getDaysInRange(new Date(), 30)
    const map = new Map<string, number>()
    const totalHabits = habits.length || 1
    for (const day of days) {
      const completedHabits = new Set(
        logs.filter((l) => l.completed_at.substring(0, 10) === day).map((l) => l.habit_id),
      ).size
      map.set(day, completedHabits / totalHabits)
    }
    return { days, map }
  }, [habits, logs])

  /** Open add modal */
  const openAdd = useCallback(() => {
    setFormTitle('')
    setFormCategory('life')
    setFormFrequency('daily')
    setFormIcon('✅')
    setFormTarget(1)
    setEditHabit(null)
    setShowAdd(true)
  }, [])

  /** Open edit modal */
  const openEdit = useCallback((habit: Habit) => {
    setFormTitle(habit.title)
    setFormCategory(habit.category)
    setFormFrequency(habit.frequency)
    setFormIcon(habit.icon)
    setFormTarget(habit.target_count)
    setEditHabit(habit)
    setShowAdd(true)
  }, [])

  /** Save habit (create or update) */
  const saveHabit = useCallback(async () => {
    if (!formTitle.trim()) return
    setSaving(true)

    if (editHabit) {
      const { error } = await supabase
        .from('habits')
        .update({
          title: formTitle.trim(),
          category: formCategory,
          frequency: formFrequency,
          icon: formIcon,
          target_count: formTarget,
        })
        .eq('id', editHabit.id)

      if (!error) {
        toast('更新しました')
        setShowAdd(false)
        load()
      }
    } else {
      const { error } = await supabase
        .from('habits')
        .insert({
          title: formTitle.trim(),
          category: formCategory,
          frequency: formFrequency,
          icon: formIcon,
          target_count: formTarget,
        })

      if (!error) {
        toast('習慣を追加しました')
        setShowAdd(false)
        load()
      }
    }
    setSaving(false)
  }, [formTitle, formCategory, formFrequency, formIcon, formTarget, editHabit, load])

  /** Delete habit (soft: set active=false) */
  const deleteHabit = useCallback(async () => {
    if (!editHabit) return
    await supabase.from('habits').update({ active: false }).eq('id', editHabit.id)
    toast('削除しました')
    setShowAdd(false)
    load()
  }, [editHabit, load])

  if (loading) {
    return (
      <div className="page">
        <PageHeader title="Habits" />
        <div style={{ color: 'var(--text3)' }}>Loading...</div>
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader title="Habits" description="小さな積み重ねが大きな変化に" />

      {/* Today's habits */}
      <div className="section">
        <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>今日の習慣</span>
          <button className="btn btn-g btn-sm" onClick={openAdd}>+ 追加</button>
        </div>

        {habits.length === 0 ? (
          <Card>
            <div style={{ textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🌱</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>
                習慣はまだありません
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
                小さなことから始めてみましょう
              </div>
              <button className="btn btn-p btn-sm" onClick={openAdd}>最初の習慣を追加</button>
            </div>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {habits.map((habit) => {
              const todayCount = getTodayCount(habit.id)
              const completed = todayCount >= habit.target_count
              return (
                <Card key={habit.id} style={{ cursor: 'pointer' }}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                    onClick={() => toggleHabit(habit)}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        border: `2px solid ${completed ? 'var(--green)' : 'var(--border)'}`,
                        background: completed ? 'var(--green)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 14,
                        color: completed ? '#fff' : 'var(--text3)',
                        transition: 'all .2s',
                        flexShrink: 0,
                      }}
                    >
                      {completed ? '✓' : ''}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: completed ? 'var(--text3)' : 'var(--text)', textDecoration: completed ? 'line-through' : 'none' }}>
                        {habit.icon} {habit.title}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                        {todayCount}/{habit.target_count}
                      </div>
                    </div>
                    <button
                      className="btn btn-g btn-sm"
                      style={{ fontSize: 10, padding: '2px 8px' }}
                      onClick={(e) => { e.stopPropagation(); openEdit(habit) }}
                    >
                      ...
                    </button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Weekly achievement */}
      {habits.length > 0 && (
        <div className="section">
          <div className="section-title">今週の達成率</div>
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {habits.map((habit) => {
                const rate = getWeekRate(habit.id)
                return (
                  <div key={habit.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: 'var(--text2)' }}>{habit.icon} {habit.title}</span>
                      <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: rate >= 80 ? 'var(--green)' : rate >= 50 ? 'var(--amber)' : 'var(--text3)' }}>
                        {rate}%
                      </span>
                    </div>
                    <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${rate}%`,
                        background: rate >= 80 ? 'var(--green)' : rate >= 50 ? 'var(--amber)' : 'var(--accent)',
                        borderRadius: 3,
                        transition: 'width .4s',
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      )}

      {/* 30-day calendar */}
      {habits.length > 0 && (
        <div className="section">
          <div className="section-title">30日カレンダー</div>
          <Card>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {calendarData.days.reverse().map((day) => {
                const ratio = calendarData.map.get(day) ?? 0
                const isToday = day === todayStr
                return (
                  <div
                    key={day}
                    title={`${day}: ${Math.round(ratio * 100)}%`}
                    style={{
                      aspectRatio: '1',
                      borderRadius: 4,
                      background: ratio === 0
                        ? 'var(--surface2)'
                        : ratio < 0.5
                          ? 'rgba(72, 187, 120, 0.3)'
                          : ratio < 1
                            ? 'rgba(72, 187, 120, 0.6)'
                            : 'var(--green)',
                      border: isToday ? '2px solid var(--accent)' : '1px solid transparent',
                      position: 'relative',
                    }}
                  >
                    <div style={{
                      position: 'absolute',
                      bottom: 1,
                      right: 2,
                      fontSize: 7,
                      color: ratio > 0.5 ? '#fff' : 'var(--text3)',
                      fontFamily: 'var(--mono)',
                    }}>
                      {parseInt(day.substring(8))}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title={editHabit ? '習慣を編集' : '習慣を追加'}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', width: '100%' }}>
            {editHabit && (
              <button className="btn btn-d btn-sm" onClick={deleteHabit}>削除</button>
            )}
            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
              <button className="btn btn-g btn-sm" onClick={() => setShowAdd(false)}>キャンセル</button>
              <button className="btn btn-p btn-sm" onClick={saveHabit} disabled={!formTitle.trim() || saving}>
                {saving ? '保存中...' : editHabit ? '更新' : '追加'}
              </button>
            </div>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Title */}
          <div>
            <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>タイトル</label>
            <input
              className="input"
              style={{ width: '100%', boxSizing: 'border-box' }}
              placeholder="例: 朝の散歩"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
            />
          </div>

          {/* Icon */}
          <div>
            <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>アイコン</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {HABIT_ICONS.map((icon) => (
                <button
                  key={icon}
                  onClick={() => setFormIcon(icon)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    border: formIcon === icon ? '2px solid var(--accent)' : '1px solid var(--border)',
                    background: formIcon === icon ? 'var(--accent-bg)' : 'transparent',
                    fontSize: 18,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>カテゴリ</label>
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

          {/* Frequency */}
          <div>
            <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>頻度</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { value: 'daily' as const, label: '毎日' },
                { value: 'weekly' as const, label: '週1回' },
                { value: 'weekdays' as const, label: '平日' },
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

          {/* Target count */}
          <div>
            <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>目標回数/日</label>
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
