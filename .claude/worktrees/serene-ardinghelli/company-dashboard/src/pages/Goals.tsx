import { useEffect, useMemo, useState } from 'react'
import { Card, PageHeader, Modal, EmptyState } from '@/components/ui'
import { toast } from '@/components/ui/Toast'
import { GOAL_LEVELS, GOAL_STATUSES } from '@/types/goals'
import type { Goal, GoalLevel, GoalStatus } from '@/types/goals'
import { useDataStore } from '@/stores/data'

const LEVEL_MAP = new Map(GOAL_LEVELS.map((l) => [l.value, l]))
const STATUS_MAP = new Map(GOAL_STATUSES.map((s) => [s.value, s]))

export function Goals() {
  const {
    goals, dreams,
    fetchGoals, fetchDreams,
    addGoal, updateGoal, deleteGoal, updateDream,
    loading,
  } = useDataStore()

  const [activeLevel, setActiveLevel] = useState<GoalLevel | ''>('')
  const [showAdd, setShowAdd] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)

  // Add form state
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newLevel, setNewLevel] = useState<GoalLevel>('monthly')
  const [newParentId, setNewParentId] = useState<string>('')
  const [newDreamId, setNewDreamId] = useState<string>('')
  const [newTargetDate, setNewTargetDate] = useState('')

  // Edit form state
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editProgress, setEditProgress] = useState(0)
  const [editStatus, setEditStatus] = useState<GoalStatus>('active')
  const [editTargetDate, setEditTargetDate] = useState('')

  useEffect(() => {
    fetchGoals()
    fetchDreams()
  }, [fetchGoals, fetchDreams])

  const detail = useMemo(() => {
    if (!detailId) return null
    return goals.find((g) => g.id === detailId) ?? null
  }, [detailId, goals])

  // Active/in_progress dreams for linking
  const activeDreams = useMemo(() => {
    return dreams.filter((d) => d.status === 'active' || d.status === 'in_progress')
  }, [dreams])

  // Filtered goals by level
  const filtered = useMemo(() => {
    if (!activeLevel) return goals
    return goals.filter((g) => g.level === activeLevel)
  }, [goals, activeLevel])

  // Group by level for display
  const groupedByLevel = useMemo(() => {
    const map = new Map<GoalLevel, Goal[]>()
    for (const l of GOAL_LEVELS) {
      map.set(l.value, [])
    }
    for (const g of filtered) {
      if (!map.has(g.level)) map.set(g.level, [])
      map.get(g.level)!.push(g)
    }
    return map
  }, [filtered])

  // Goal map for parent lookup
  const goalMap = useMemo(() => {
    const map = new Map<string, Goal>()
    for (const g of goals) map.set(g.id, g)
    return map
  }, [goals])

  // Dream map
  const dreamMap = useMemo(() => {
    const map = new Map<string, typeof dreams[0]>()
    for (const d of dreams) map.set(d.id, d)
    return map
  }, [dreams])

  // Children map
  const childrenMap = useMemo(() => {
    const map = new Map<string, Goal[]>()
    for (const g of goals) {
      if (g.parent_id) {
        if (!map.has(g.parent_id)) map.set(g.parent_id, [])
        map.get(g.parent_id)!.push(g)
      }
    }
    return map
  }, [goals])

  // Possible parents for add form
  const possibleParents = useMemo(() => {
    return goals.filter((g) => g.status === 'active' || g.status === 'achieved')
  }, [goals])

  // Stats
  const stats = useMemo(() => {
    const active = goals.filter((g) => g.status === 'active').length
    const achieved = goals.filter((g) => g.status === 'achieved').length
    return { active, achieved, total: goals.length }
  }, [goals])

  function resetAddForm() {
    setNewTitle('')
    setNewDesc('')
    setNewLevel('monthly')
    setNewParentId('')
    setNewDreamId('')
    setNewTargetDate('')
  }

  async function handleAddGoal() {
    if (!newTitle.trim()) return
    const result = await addGoal({
      title: newTitle.trim(),
      description: newDesc.trim() || null,
      level: newLevel,
      parent_id: newParentId ? Number(newParentId) : null,
      dream_id: newDreamId || null,
      target_date: newTargetDate || null,
    })
    if (result) {
      resetAddForm()
      setShowAdd(false)
      toast('目標を追加しました')
    }
  }

  function openDetail(goal: Goal) {
    setDetailId(goal.id)
    setEditMode(false)
    setEditTitle(goal.title)
    setEditDesc(goal.description || '')
    setEditProgress(goal.progress)
    setEditStatus(goal.status)
    setEditTargetDate(goal.target_date || '')
  }

  async function saveEdit() {
    if (!detail) return
    const updates = {
      title: editTitle.trim(),
      description: editDesc.trim() || null,
      progress: editProgress,
      status: editStatus,
      target_date: editTargetDate || null,
      achieved_at: editStatus === 'achieved' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }
    await updateGoal(detail.id, updates)

    // Auto-update linked dream status
    if (editStatus === 'achieved' && detail.dream_id) {
      await syncDreamStatus(detail.dream_id)
    }

    setDetailId(null)
    toast('目標を更新しました')
  }

  /**
   * Sync dream status based on linked goals.
   * If all goals for the dream are achieved, set dream to 'achieved'.
   * Otherwise set to 'in_progress'.
   */
  async function syncDreamStatus(dreamId: string) {
    const linkedGoals = goals.filter((g) => g.dream_id === dreamId)
    if (linkedGoals.length === 0) return

    const allAchieved = linkedGoals.every((g) =>
      g.id === detail?.id ? true : g.status === 'achieved',
    )

    if (allAchieved) {
      await updateDream(dreamId, {
        status: 'achieved',
        achieved_at: new Date().toISOString(),
      })
      const dream = dreamMap.get(dreamId)
      if (dream) toast(`夢「${dream.title}」が達成されました！`)
    } else {
      const dream = dreamMap.get(dreamId)
      if (dream && dream.status === 'active') {
        await updateDream(dreamId, { status: 'in_progress' })
      }
    }
  }

  async function handleUpdateProgress(goal: Goal, progress: number) {
    const updates: Record<string, unknown> = { progress, updated_at: new Date().toISOString() }
    if (progress >= 100) {
      updates.status = 'achieved'
      updates.achieved_at = new Date().toISOString()
    }
    await updateGoal(goal.id, updates)

    // Auto-update linked dream status
    if (progress >= 100 && goal.dream_id) {
      await syncDreamStatus(goal.dream_id)
    }
  }

  async function handleDeleteGoal(goal: Goal) {
    await deleteGoal(goal.id)
    setDetailId(null)
    toast(`「${goal.title}」を削除しました`)
  }

  async function handleStatusChange(goal: Goal, newStatus: GoalStatus) {
    const updates: Record<string, unknown> = {
      status: newStatus,
      achieved_at: newStatus === 'achieved' ? new Date().toISOString() : null,
      progress: newStatus === 'achieved' ? 100 : goal.progress,
      updated_at: new Date().toISOString(),
    }
    await updateGoal(goal.id, updates)

    // Auto-update linked dream status
    if (newStatus === 'achieved' && goal.dream_id) {
      await syncDreamStatus(goal.dream_id)
    }

    setDetailId(null)
    const label = GOAL_STATUSES.find((s) => s.value === newStatus)?.label || newStatus
    toast(`「${goal.title}」を${label}に変更しました`)
  }

  /** Render a goal item with optional children */
  function renderGoalItem(goal: Goal, indent = 0) {
    const children = childrenMap.get(goal.id) || []
    const dream = goal.dream_id ? dreamMap.get(goal.dream_id) : null
    const statusIcon = goal.status === 'achieved' ? '✅'
      : goal.status === 'paused' ? '⏸'
      : goal.status === 'dropped' ? '✕'
      : '○'

    return (
      <div key={goal.id}>
        <div
          style={{
            padding: '10px 0',
            paddingLeft: indent * 20,
            borderBottom: '1px solid var(--border)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13,
          }}
          onClick={() => openDetail(goal)}
        >
          <span style={{ fontSize: 14, flexShrink: 0 }}>{statusIcon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontWeight: 500,
              color: goal.status === 'achieved' ? 'var(--text3)' : 'var(--text)',
              textDecoration: goal.status === 'achieved' ? 'line-through' : 'none',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {goal.title}
            </div>
            {dream && (
              <div style={{ fontSize: 10, color: 'var(--accent2)', marginTop: 2 }}>
                夢: {dream.title}
              </div>
            )}
          </div>
          {/* Progress bar */}
          <div style={{ width: 60, flexShrink: 0 }}>
            <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${goal.progress}%`,
                background: goal.progress >= 100 ? 'var(--green)' : 'var(--accent)',
                borderRadius: 2,
                transition: 'width .3s',
              }} />
            </div>
            <div style={{ fontSize: 9, color: 'var(--text3)', textAlign: 'right', marginTop: 1, fontFamily: 'var(--mono)' }}>
              {goal.progress}%
            </div>
          </div>
        </div>
        {/* Render children */}
        {children
          .filter(() => true) // show children regardless of filter
          .map((child) => renderGoalItem(child, indent + 1))}
      </div>
    )
  }

  const isLoading = loading.goals

  if (isLoading && goals.length === 0) {
    return (
      <div className="page">
        <PageHeader title="Goals" />
        <div style={{ color: 'var(--text3)' }}>Loading...</div>
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        title="Goals"
        description="夢を叶えるための具体的な行動計画。life → yearly → quarterly → monthly → weekly に分解。"
        actions={
          <button className="btn btn-p btn-sm" onClick={() => setShowAdd(true)}>
            + 目標を追加
          </button>
        }
      />

      {/* Stats */}
      {goals.length > 0 && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 12, color: 'var(--text2)' }}>
          <span>進行中: <strong>{stats.active}</strong></span>
          <span>達成: <strong>{stats.achieved}</strong></span>
          <span>全: <strong>{stats.total}</strong></span>
        </div>
      )}

      {/* Level filter tabs */}
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <button
          className={`btn btn-sm ${activeLevel === '' ? 'btn-p' : 'btn-g'}`}
          onClick={() => setActiveLevel('')}
        >
          全て
        </button>
        {GOAL_LEVELS.map((l) => (
          <button
            key={l.value}
            className={`btn btn-sm ${activeLevel === l.value ? 'btn-p' : 'btn-g'}`}
            onClick={() => setActiveLevel(l.value)}
          >
            {l.icon} {l.label}
          </button>
        ))}
      </div>

      {/* Goal list grouped by level */}
      {goals.length === 0 ? (
        <Card>
          <EmptyState
            icon="🎯"
            message="まだ目標がありません。最初の目標を追加してみましょう。"
            actionLabel="目標を追加"
            onAction={() => setShowAdd(true)}
          />
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {GOAL_LEVELS.map((level) => {
            const items = groupedByLevel.get(level.value) || []
            const topLevel = items.filter((g) => !g.parent_id)
            if (topLevel.length === 0 && activeLevel) return null
            if (topLevel.length === 0) return null
            return (
              <div key={level.value}>
                <div className="section-title" style={{ marginBottom: 8 }}>
                  {level.icon} {level.label}の目標 ({items.length}件)
                </div>
                <Card>
                  {topLevel.map((g) => renderGoalItem(g))}
                </Card>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Goal Modal */}
      <Modal open={showAdd} onClose={() => { setShowAdd(false); resetAddForm() }} title="新しい目標を追加">
        <div style={{ marginBottom: 12 }}>
          <label className="form-label">タイトル</label>
          <input
            className="input"
            placeholder="何を達成したいですか?"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label className="form-label">説明 (任意)</label>
          <textarea
            className="input"
            placeholder="詳しく書いてみてください..."
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            style={{ minHeight: 60 }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label className="form-label">レベル</label>
          <select
            className="input"
            value={newLevel}
            onChange={(e) => setNewLevel(e.target.value as GoalLevel)}
          >
            {GOAL_LEVELS.map((l) => (
              <option key={l.value} value={l.value}>{l.icon} {l.label}</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label className="form-label">親目標 (任意)</label>
          <select
            className="input"
            value={newParentId}
            onChange={(e) => setNewParentId(e.target.value)}
          >
            <option value="">なし</option>
            {possibleParents.map((g) => (
              <option key={g.id} value={g.id}>
                {LEVEL_MAP.get(g.level)?.icon} {g.title}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label className="form-label">夢との紐付け (任意)</label>
          <select
            className="input"
            value={newDreamId}
            onChange={(e) => setNewDreamId(e.target.value)}
          >
            <option value="">なし</option>
            {activeDreams.map((d) => (
              <option key={d.id} value={d.id}>{d.title}</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label className="form-label">目標日 (任意)</label>
          <input
            className="input"
            type="date"
            value={newTargetDate}
            onChange={(e) => setNewTargetDate(e.target.value)}
          />
        </div>
        <button
          className="btn btn-p"
          style={{ width: '100%' }}
          onClick={handleAddGoal}
          disabled={!newTitle.trim()}
        >
          追加する
        </button>
      </Modal>

      {/* Detail/Edit Modal */}
      <Modal
        open={!!detail}
        onClose={() => { setDetailId(null); setEditMode(false) }}
        title={editMode ? '目標を編集' : detail?.title || ''}
        footer={
          detail ? (
            <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'space-between' }}>
              <button className="btn btn-d btn-sm" onClick={() => handleDeleteGoal(detail)}>削除</button>
              <div style={{ display: 'flex', gap: 8 }}>
                {editMode ? (
                  <button className="btn btn-p btn-sm" onClick={saveEdit}>保存</button>
                ) : (
                  <button className="btn btn-g btn-sm" onClick={() => setEditMode(true)}>編集</button>
                )}
              </div>
            </div>
          ) : undefined
        }
      >
        {detail && !editMode && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <span className="tag tag-co">
                {LEVEL_MAP.get(detail.level)?.icon} {LEVEL_MAP.get(detail.level)?.label}
              </span>
              <span className={`tag ${detail.status === 'achieved' ? 'tag-done' : detail.status === 'paused' ? 'tag-open' : 'tag-in_progress'}`}>
                {STATUS_MAP.get(detail.status)?.label}
              </span>
            </div>
            {detail.description && (
              <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 12 }}>
                {detail.description}
              </p>
            )}
            {/* Progress */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text2)' }}>進捗</span>
                <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{detail.progress}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={detail.progress}
                onChange={(e) => {
                  const val = Number(e.target.value)
                  handleUpdateProgress(detail, val)
                }}
                style={{ width: '100%' }}
              />
            </div>
            {/* Parent goal */}
            {detail.parent_id && goalMap.has(detail.parent_id) && (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>
                上位目標: {goalMap.get(detail.parent_id)?.title}
              </div>
            )}
            {/* Dream */}
            {detail.dream_id && dreamMap.has(detail.dream_id) && (
              <div style={{ fontSize: 11, color: 'var(--accent2)', marginBottom: 8 }}>
                紐付き夢: {dreamMap.get(detail.dream_id)?.title}
              </div>
            )}
            {/* Quick status change */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
              {GOAL_STATUSES.filter((s) => s.value !== detail.status).map((s) => (
                <button
                  key={s.value}
                  className={`btn btn-sm ${s.value === 'achieved' ? 'btn-p' : 'btn-g'}`}
                  onClick={() => handleStatusChange(detail, s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: 12 }}>
              作成: {new Date(detail.created_at).toLocaleDateString('ja-JP')}
              {detail.target_date && <span> / 目標日: {detail.target_date}</span>}
              {detail.achieved_at && <span> / 達成: {new Date(detail.achieved_at).toLocaleDateString('ja-JP')}</span>}
            </div>
          </div>
        )}
        {detail && editMode && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">タイトル</label>
              <input
                className="input"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">説明</label>
              <textarea
                className="input"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                style={{ minHeight: 60 }}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">ステータス</label>
              <select
                className="input"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as GoalStatus)}
              >
                {GOAL_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">進捗 ({editProgress}%)</label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={editProgress}
                onChange={(e) => setEditProgress(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">目標日</label>
              <input
                className="input"
                type="date"
                value={editTargetDate}
                onChange={(e) => setEditTargetDate(e.target.value)}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
