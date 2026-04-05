import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, PageHeader, Modal, EmptyState, Tag } from '@/components/ui'
import { toast } from '@/components/ui/Toast'
import { DREAM_STATUSES } from '@/types/dreams'
import type { DreamStatus, Dream } from '@/types/dreams'
import { GOAL_LEVELS, GOAL_STATUSES } from '@/types/goals'
import type { Goal, GoalLevel, GoalStatus } from '@/types/goals'
import { useDataStore } from '@/stores/data'
import { aiCompletion } from '@/lib/edgeAi'

/* ── Dynamic Categories ── */

interface Category {
  value: string
  label: string
  icon: string
}

function deriveCategories(dreams: Dream[]): Category[] {
  const catSet = new Set<string>()
  for (const d of dreams) if (d.category) catSet.add(d.category)
  return [...catSet].map((v) => ({ value: v, label: v, icon: getCategoryIcon(v) })).sort((a, b) => a.label.localeCompare(b.label))
}

function getCategoryIcon(cat: string): string {
  const map: Record<string, string> = {
    career: '🎯', travel: '✈️', skill: '📚', health: '💪',
    relationship: '❤️', creative: '🎨', financial: '💰',
    experience: '🌟', other: '✨', キャリア: '🎯', 旅行: '✈️',
    スキル: '📚', 健康: '💪', 人間関係: '❤️', クリエイティブ: '🎨',
    資産: '💰', 体験: '🌟', その他: '✨',
  }
  return map[cat] || '📌'
}

/* ── AI Classification ── */

async function classifyDream(
  title: string, description: string, existingCategories: Category[],
): Promise<{ category: string; isNew: boolean }> {
  const catList = existingCategories.map((c) => `${c.icon} ${c.value}`).join(', ')
  const result = await aiCompletion(
    `以下の「夢」を最適なカテゴリに分類してください。

夢: ${title}
${description ? `説明: ${description}` : ''}

既存カテゴリ: [${catList || 'なし'}]

ルール:
- 既存カテゴリに当てはまるならそのカテゴリ名を返す
- 当てはまらない場合は新しいカテゴリ名を作成（短く、日本語）
- カテゴリ名のみ返す`,
    { model: 'gpt-5-nano', temperature: 0.2, maxTokens: 50 },
  )
  const category = result.content.trim().replace(/^[「『"']+|[」』"']+$/g, '')
  const isNew = !existingCategories.some((c) => c.value === category)
  return { category, isNew }
}

async function reviewCategories(
  dreams: Dream[], currentCategories: Category[],
): Promise<{ newCategories: Record<string, string>; reason: string } | null> {
  if (dreams.length < 3) return null
  const dreamList = dreams.map((d) => `- "${d.title}" → ${d.category}`).join('\n')
  const catList = currentCategories.map((c) => c.value).join(', ')
  const result = await aiCompletion(
    `以下の夢リストとカテゴリ分類を見直すべきか判断してください。

現在のカテゴリ: [${catList}]
夢リスト:
${dreamList}

JSON形式で返してください:
{"needs_review": true/false, "reason": "理由", "changes": {"旧カテゴリ": "新カテゴリ"}}

基準: 1件カテゴリ複数→統合、5件以上→分割、類似→統合`,
    { model: 'gpt-5-nano', temperature: 0.2, maxTokens: 500, jsonMode: true },
  )
  try {
    const parsed = JSON.parse(result.content)
    if (!parsed.needs_review) return null
    return { newCategories: parsed.changes || {}, reason: parsed.reason || '' }
  } catch { return null }
}

/* ── Tabs ── */

type TabType = 'dreams' | 'goals'


/* ── Component ── */

export function Dreams() {
  const {
    dreams, goals,
    fetchDreams, fetchGoals,
    addDream, updateDream, deleteDream,
    addGoal, updateGoal, deleteGoal,
    loading,
  } = useDataStore()

  const [activeTab, setActiveTab] = useState<TabType>('dreams')
  const [filter, setFilter] = useState<DreamStatus | ''>('')
  const [goalFilter, setGoalFilter] = useState<GoalLevel | ''>('')
  const [showAdd, setShowAdd] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [classifying, setClassifying] = useState(false)
  const [reviewing, setReviewing] = useState(false)

  // Dream add form
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [suggestedCat, setSuggestedCat] = useState<string | null>(null)
  const [manualCat, setManualCat] = useState('')

  // Goal add form
  const [goalTitle, setGoalTitle] = useState('')
  const [goalDesc, setGoalDesc] = useState('')
  const [goalLevel, setGoalLevel] = useState<GoalLevel>('yearly')
  const [goalYear, setGoalYear] = useState(String(new Date().getFullYear()))
  const [goalMonth, setGoalMonth] = useState('')
  const [goalDay, setGoalDay] = useState('')
  const [goalDreamId, setGoalDreamId] = useState('')

  // Goal detail edit
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)

  useEffect(() => {
    fetchDreams()
    fetchGoals()
  }, [fetchDreams, fetchGoals])

  const categories = useMemo(() => deriveCategories(dreams), [dreams])


  const detail = useMemo(() => {
    if (!detailId) return null
    return dreams.find((d) => d.id === detailId) ?? null
  }, [detailId, dreams])

  const filtered = useMemo(() => {
    const base = filter ? dreams.filter((d) => d.status === filter) : dreams
    return base
  }, [dreams, filter])

  const grouped = useMemo(() => {
    const map = new Map<string, typeof dreams>()
    for (const d of filtered) {
      const cat = d.category || 'other'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(d)
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [filtered])

  const dreamStats = useMemo(() => ({
    achieved: dreams.filter((d) => d.status === 'achieved').length,
    inProgress: dreams.filter((d) => d.status === 'in_progress').length,
    total: dreams.length,
  }), [dreams])

  const goalStats = useMemo(() => ({
    active: goals.filter((g) => g.status === 'active').length,
    achieved: goals.filter((g) => g.status === 'achieved').length,
    total: goals.length,
  }), [goals])

  const filteredGoals = useMemo(() => {
    if (!goalFilter) return goals.filter((g) => g.status === 'active' || g.status === 'achieved')
    return goals.filter((g) => g.level === goalFilter)
  }, [goals, goalFilter])

  const goalsByLevel = useMemo(() => {
    const map = new Map<GoalLevel, Goal[]>()
    for (const l of GOAL_LEVELS) map.set(l.value, [])
    for (const g of filteredGoals) {
      if (!map.has(g.level)) map.set(g.level, [])
      map.get(g.level)!.push(g)
    }
    return map
  }, [filteredGoals])

  const linkedGoals = useMemo(() => {
    if (!detail) return []
    return goals.filter((g) => g.dream_id === detail.id)
  }, [detail, goals])

  const activeDreams = useMemo(() => dreams.filter((d) => d.status === 'active' || d.status === 'in_progress'), [dreams])
  const dreamMap = useMemo(() => new Map(dreams.map((d) => [d.id, d])), [dreams])

  // AI classify
  const runClassify = useCallback(async (title: string, desc: string) => {
    if (!title.trim()) { setSuggestedCat(null); return }
    setClassifying(true)
    try {
      const result = await classifyDream(title, desc, categories)
      setSuggestedCat(result.category)
      if (result.isNew) toast(`新カテゴリ「${result.category}」を提案`)
    } catch { setSuggestedCat(null) }
    setClassifying(false)
  }, [categories])

  async function handleAddDream() {
    if (!newTitle.trim()) return
    const category = manualCat || suggestedCat || 'other'
    const result = await addDream({ title: newTitle.trim(), description: newDesc.trim() || null, category })
    if (result) {
      setNewTitle(''); setNewDesc(''); setSuggestedCat(null); setManualCat(''); setShowAdd(false)
      toast(`「${category}」に分類して追加しました`)
    }
  }

  function buildTargetDate(): string | null {
    if (!goalYear) return null
    if (goalLevel === 'life') return null
    if (goalLevel === 'yearly') return `${goalYear}-12-31`
    if (goalLevel === 'quarterly' || goalLevel === 'monthly') {
      const m = goalMonth || '12'
      const lastDay = new Date(Number(goalYear), Number(m), 0).getDate()
      return `${goalYear}-${m.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    }
    // weekly or specific date
    if (goalDay) return `${goalYear}-${(goalMonth || '01').padStart(2, '0')}-${goalDay.padStart(2, '0')}`
    if (goalMonth) {
      const lastDay = new Date(Number(goalYear), Number(goalMonth), 0).getDate()
      return `${goalYear}-${goalMonth.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    }
    return `${goalYear}-12-31`
  }

  async function handleAddGoal() {
    if (!goalTitle.trim()) return
    const result = await addGoal({
      title: goalTitle.trim(),
      description: goalDesc.trim() || null,
      level: goalLevel,
      target_date: buildTargetDate(),
      dream_id: goalDreamId || null,
    })
    if (result) {
      setGoalTitle(''); setGoalDesc(''); setGoalYear(String(new Date().getFullYear())); setGoalMonth(''); setGoalDay(''); setGoalDreamId(''); setShowAdd(false)
      toast('目標を追加しました')
    }
  }

  async function handleReviewCategories() {
    setReviewing(true)
    try {
      const result = await reviewCategories(dreams, categories)
      if (!result) { toast('現在のカテゴリ構造は適切です'); setReviewing(false); return }
      const entries = Object.entries(result.newCategories)
      if (entries.length === 0) { toast('変更なし: ' + result.reason); setReviewing(false); return }
      let updated = 0
      for (const dream of dreams) {
        const newCat = result.newCategories[dream.category]
        if (newCat) { await updateDream(dream.id, { category: newCat }); updated++ }
      }
      await fetchDreams()
      toast(`${result.reason} — ${updated}件を再分類しました`)
    } catch { toast('カテゴリ見直しに失敗しました') }
    setReviewing(false)
  }

  async function handleGoalStatusChange(goal: Goal, newStatus: GoalStatus) {
    const updates: Record<string, unknown> = {
      status: newStatus,
      achieved_at: newStatus === 'achieved' ? new Date().toISOString() : null,
      progress: newStatus === 'achieved' ? 100 : goal.progress,
    }
    await updateGoal(goal.id, updates)
    if (newStatus === 'achieved' && goal.dream_id) {
      const linkedGoals_ = goals.filter((g) => g.dream_id === goal.dream_id)
      const allDone = linkedGoals_.every((g) => g.id === goal.id || g.status === 'achieved')
      if (allDone) {
        await updateDream(goal.dream_id, { status: 'achieved', achieved_at: new Date().toISOString() })
        toast('紐づく夢も達成しました！')
      }
    }
    toast(GOAL_STATUSES.find((s) => s.value === newStatus)?.label + 'に変更しました')
  }

  async function handleUpdateProgress(goal: Goal, progress: number) {
    const updates: Record<string, unknown> = { progress }
    if (progress >= 100) { updates.status = 'achieved'; updates.achieved_at = new Date().toISOString() }
    await updateGoal(goal.id, updates)
  }

  const isLoading = loading.dreams || loading.goals

  if (isLoading && dreams.length === 0 && goals.length === 0) {
    return <div className="page"><PageHeader title="Dreams & Goals" /><div style={{ color: 'var(--text3)' }}>Loading...</div></div>
  }

  return (
    <div className="page">
      <PageHeader
        title="Dreams & Goals"
        description="夢 = いつかやりたいこと。目標 = 期限のある具体的な計画。"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            {activeTab === 'dreams' && dreams.length >= 3 && (
              <button className="btn btn-g btn-sm" onClick={handleReviewCategories} disabled={reviewing}>
                {reviewing ? '分析中...' : 'カテゴリ見直し'}
              </button>
            )}
            <button className="btn btn-p btn-sm" onClick={() => setShowAdd(true)}>
              + {activeTab === 'dreams' ? '夢' : '目標'}を追加
            </button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="tasks-tabs">
        <button className={`tasks-tab${activeTab === 'dreams' ? ' active' : ''}`} onClick={() => setActiveTab('dreams')}>
          夢
          {dreamStats.total > 0 && <span className="tasks-tab-count">{dreamStats.total}</span>}
        </button>
        <button className={`tasks-tab${activeTab === 'goals' ? ' active' : ''}`} onClick={() => setActiveTab('goals')}>
          目標
          {goalStats.active > 0 && <span className="tasks-tab-count">{goalStats.active}</span>}
        </button>
      </div>

      {/* ════════ Dreams Tab ════════ */}
      {activeTab === 'dreams' && (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 12, color: 'var(--text2)' }}>
            <span>達成: <strong>{dreamStats.achieved}</strong></span>
            <span>進行中: <strong>{dreamStats.inProgress}</strong></span>
            <span>全: <strong>{dreamStats.total}</strong></span>
          </div>

          <div className="filter-bar">
            {[{ value: '' as const, label: '全て' }, ...DREAM_STATUSES].map((s) => (
              <button key={s.value} className={`btn btn-sm ${filter === s.value ? 'btn-p' : 'btn-g'}`}
                onClick={() => setFilter(s.value as DreamStatus | '')}>
                {s.label}
              </button>
            ))}
          </div>

          {dreams.length === 0 ? (
            <Card><EmptyState icon="🌟" message="まだ夢がありません。" actionLabel="夢を追加" onAction={() => setShowAdd(true)} /></Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {grouped.map(([catValue, items]) => (
                <div key={catValue}>
                  <div className="section-title" style={{ marginBottom: 8 }}>
                    {getCategoryIcon(catValue)} {catValue} ({items.length}件)
                  </div>
                  <Card>
                    {items.map((d) => (
                      <div key={d.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}
                        onClick={() => setDetailId(d.id)}>
                        <span style={{ fontSize: 14 }}>
                          {d.status === 'achieved' ? '✅' : d.status === 'in_progress' ? '🔄' : d.status === 'paused' ? '⏸' : '☐'}
                        </span>
                        <span style={{ flex: 1, textDecoration: d.status === 'achieved' ? 'line-through' : 'none', color: d.status === 'achieved' ? 'var(--text3)' : 'var(--text)', fontWeight: 500 }}>
                          {d.title}
                        </span>
                        {goals.some((g) => g.dream_id === d.id) && (
                          <span style={{ fontSize: 10, color: 'var(--accent2)', fontFamily: 'var(--mono)' }}>
                            {goals.filter((g) => g.dream_id === d.id && g.status === 'achieved').length}/{goals.filter((g) => g.dream_id === d.id).length} goals
                          </span>
                        )}
                      </div>
                    ))}
                  </Card>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ════════ Goals Tab ════════ */}
      {activeTab === 'goals' && (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 12, color: 'var(--text2)' }}>
            <span>進行中: <strong>{goalStats.active}</strong></span>
            <span>達成: <strong>{goalStats.achieved}</strong></span>
            <span>全: <strong>{goalStats.total}</strong></span>
          </div>

          <div className="filter-bar" style={{ marginBottom: 16 }}>
            <button className={`btn btn-sm ${goalFilter === '' ? 'btn-p' : 'btn-g'}`} onClick={() => setGoalFilter('')}>全て</button>
            {GOAL_LEVELS.map((l) => (
              <button key={l.value} className={`btn btn-sm ${goalFilter === l.value ? 'btn-p' : 'btn-g'}`}
                onClick={() => setGoalFilter(l.value)}>
                {l.icon} {l.label}
              </button>
            ))}
          </div>

          {goals.length === 0 ? (
            <Card><EmptyState icon="🎯" message="まだ目標がありません。期限のある計画を追加しましょう。" actionLabel="目標を追加" onAction={() => setShowAdd(true)} /></Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {GOAL_LEVELS.map((level) => {
                const items = (goalsByLevel.get(level.value) || []).filter((g) => !g.parent_id)
                if (items.length === 0) return null
                return (
                  <div key={level.value}>
                    <div className="section-title" style={{ marginBottom: 8 }}>
                      {level.icon} {level.label}の目標 ({items.length}件)
                    </div>
                    <Card>
                      {items.map((g) => {
                        const dream = g.dream_id ? dreamMap.get(g.dream_id) : null
                        const isAchieved = g.status === 'achieved'
                        const isOverdue = g.target_date && g.target_date < new Date().toISOString().substring(0, 10) && !isAchieved
                        return (
                          <div key={g.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}
                            onClick={() => setEditingGoal({ ...g })}>
                            <span style={{ fontSize: 14 }}>{isAchieved ? '✅' : g.status === 'paused' ? '⏸' : '○'}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 500, color: isAchieved ? 'var(--text3)' : 'var(--text)', textDecoration: isAchieved ? 'line-through' : 'none' }}>
                                {g.title}
                              </div>
                              <div style={{ display: 'flex', gap: 8, marginTop: 2, alignItems: 'center' }}>
                                {dream && <span style={{ fontSize: 10, color: 'var(--accent2)' }}>夢: {dream.title}</span>}
                                {g.target_date && (
                                  <span style={{ fontSize: 10, color: isOverdue ? 'var(--red)' : 'var(--text3)', fontFamily: 'var(--mono)' }}>
                                    {isOverdue ? '⚠ ' : ''}{g.target_date}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div style={{ width: 60, flexShrink: 0 }}>
                              <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${g.progress}%`, background: g.progress >= 100 ? 'var(--green)' : 'var(--accent)', borderRadius: 2 }} />
                              </div>
                              <div style={{ fontSize: 9, color: 'var(--text3)', textAlign: 'right', marginTop: 1, fontFamily: 'var(--mono)' }}>{g.progress}%</div>
                            </div>
                          </div>
                        )
                      })}
                    </Card>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ════════ Add Modal ════════ */}
      <Modal open={showAdd} onClose={() => { setShowAdd(false); setSuggestedCat(null); setManualCat('') }}
        title={activeTab === 'dreams' ? '新しい夢を追加' : '新しい目標を追加'}>
        {activeTab === 'dreams' ? (
          <>
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">タイトル</label>
              <input className="input" placeholder="あなたの夢は?" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                onBlur={() => runClassify(newTitle, newDesc)} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">説明 (任意)</label>
              <textarea className="input" placeholder="詳しく..." value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
                onBlur={() => newTitle.trim() && runClassify(newTitle, newDesc)} style={{ minHeight: 60 }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">カテゴリ</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {classifying ? <span style={{ fontSize: 12, color: 'var(--text3)' }}>AI分類中...</span>
                  : suggestedCat ? <span className="tag tag-co" style={{ fontSize: 12 }}>{getCategoryIcon(suggestedCat)} {suggestedCat}</span>
                    : <span style={{ fontSize: 12, color: 'var(--text3)' }}>入力後に自動分類</span>}
                <input className="input" placeholder="手動で変更" value={manualCat} onChange={(e) => setManualCat(e.target.value)}
                  style={{ flex: 1, fontSize: 12, padding: '4px 8px' }} />
              </div>
            </div>
            <button className="btn btn-p" style={{ width: '100%' }} onClick={handleAddDream} disabled={!newTitle.trim() || classifying}>
              追加する
            </button>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">何を達成する？</label>
              <input className="input" placeholder="具体的な目標" value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">説明 (任意)</label>
              <textarea className="input" placeholder="詳しく..." value={goalDesc} onChange={(e) => setGoalDesc(e.target.value)} style={{ minHeight: 50 }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">スケール</label>
              <div className="filter-bar" style={{ marginBottom: 0 }}>
                {GOAL_LEVELS.map((l) => (
                  <button key={l.value} className={`btn btn-sm ${goalLevel === l.value ? 'btn-p' : 'btn-g'}`}
                    onClick={() => setGoalLevel(l.value)} type="button">
                    {l.icon} {l.label}
                  </button>
                ))}
              </div>
            </div>
            {goalLevel !== 'life' && (
              <div className="form-row" style={{ marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">年</label>
                  <select className="input" value={goalYear} onChange={(e) => setGoalYear(e.target.value)} style={{ width: '100%' }}>
                    {Array.from({ length: 11 }, (_, i) => String(new Date().getFullYear() + i)).map((y) => (
                      <option key={y} value={y}>{y}年</option>
                    ))}
                  </select>
                </div>
                {(goalLevel === 'quarterly' || goalLevel === 'monthly' || goalLevel === 'weekly') && (
                  <div style={{ flex: 1 }}>
                    <label className="form-label">月</label>
                    <select className="input" value={goalMonth} onChange={(e) => setGoalMonth(e.target.value)} style={{ width: '100%' }}>
                      <option value="">-</option>
                      {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((m) => (
                        <option key={m} value={m}>{m}月</option>
                      ))}
                    </select>
                  </div>
                )}
                {goalLevel === 'weekly' && goalMonth && (
                  <div style={{ flex: 1 }}>
                    <label className="form-label">日</label>
                    <select className="input" value={goalDay} onChange={(e) => setGoalDay(e.target.value)} style={{ width: '100%' }}>
                      <option value="">-</option>
                      {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => (
                        <option key={d} value={d}>{d}日</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">夢との紐付け (任意)</label>
              <select className="input" value={goalDreamId} onChange={(e) => setGoalDreamId(e.target.value)} style={{ width: '100%' }}>
                <option value="">なし</option>
                {activeDreams.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
            </div>
            <button className="btn btn-p" style={{ width: '100%' }} onClick={handleAddGoal} disabled={!goalTitle.trim()}>
              追加する
            </button>
          </>
        )}
      </Modal>

      {/* ════════ Dream Detail Modal ════════ */}
      <Modal open={!!detail} onClose={() => setDetailId(null)} title={detail?.title || ''}
        footer={detail ? (
          <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'space-between' }}>
            <button className="btn btn-d btn-sm" onClick={() => { deleteDream(detail.id); setDetailId(null); toast('削除しました') }}>削除</button>
            <div style={{ display: 'flex', gap: 8 }}>
              {DREAM_STATUSES.filter((s) => s.value !== detail.status).map((s) => (
                <button key={s.value} className={`btn btn-sm ${s.value === 'achieved' ? 'btn-p' : 'btn-g'}`}
                  onClick={() => { updateDream(detail.id, { status: s.value, achieved_at: s.value === 'achieved' ? new Date().toISOString() : null }); setDetailId(null); toast(`${s.label}に変更`) }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ) : undefined}>
        {detail && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">タイトル</label>
              <input className="input" value={detail.title}
                onChange={(e) => updateDream(detail.id, { title: e.target.value })}
                onBlur={() => toast('保存しました')}
                style={{ width: '100%', fontSize: 14, fontWeight: 500 }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">説明</label>
              <textarea className="input" value={detail.description || ''}
                onChange={(e) => updateDream(detail.id, { description: e.target.value || null })}
                onBlur={() => toast('保存しました')}
                placeholder="詳しく..."
                style={{ width: '100%', minHeight: 60 }} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <label className="form-label">カテゴリ</label>
                <input className="input" value={detail.category}
                  onChange={(e) => updateDream(detail.id, { category: e.target.value })}
                  style={{ width: 'auto', maxWidth: 160, fontSize: 12, padding: '4px 8px' }} />
              </div>
              <Tag variant={detail.status === 'achieved' ? 'done' : detail.status === 'in_progress' ? 'in_progress' : 'open'}>
                {DREAM_STATUSES.find((s) => s.value === detail.status)?.label || detail.status}
              </Tag>
            </div>
            {linkedGoals.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 8 }}>紐づく目標 ({linkedGoals.length}件)</div>
                {linkedGoals.map((g) => (
                  <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: g.status === 'achieved' ? 'var(--green)' : 'var(--text2)', fontWeight: 500, flex: 1 }}>
                      {g.status === 'achieved' ? '✅' : '○'} {g.title}
                    </span>
                    <span style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{g.progress}%</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
              作成: {new Date(detail.created_at).toLocaleDateString('ja-JP')}
              {detail.achieved_at && <span> / 達成: {new Date(detail.achieved_at).toLocaleDateString('ja-JP')}</span>}
            </div>
          </div>
        )}
      </Modal>

      {/* ════════ Goal Detail Modal ════════ */}
      <Modal open={!!editingGoal} onClose={() => setEditingGoal(null)} title={editingGoal ? '目標の詳細' : ''}
        footer={editingGoal ? (
          <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'space-between' }}>
            <button className="btn btn-d btn-sm" onClick={() => { deleteGoal(editingGoal.id); setEditingGoal(null); toast('削除しました') }}>削除</button>
            <div style={{ display: 'flex', gap: 6 }}>
              {GOAL_STATUSES.filter((s) => s.value !== editingGoal.status).map((s) => (
                <button key={s.value} className={`btn btn-sm ${s.value === 'achieved' ? 'btn-p' : 'btn-g'}`}
                  onClick={() => { handleGoalStatusChange(editingGoal, s.value); setEditingGoal(null) }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ) : undefined}>
        {editingGoal && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">タイトル</label>
              <input className="input" value={editingGoal.title}
                onChange={(e) => setEditingGoal({ ...editingGoal, title: e.target.value })}
                onBlur={() => { updateGoal(editingGoal.id, { title: editingGoal.title }); toast('保存しました') }}
                style={{ width: '100%', fontSize: 14, fontWeight: 500 }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">説明</label>
              <textarea className="input" value={editingGoal.description || ''}
                onChange={(e) => setEditingGoal({ ...editingGoal, description: e.target.value || null })}
                onBlur={() => { updateGoal(editingGoal.id, { description: editingGoal.description }); toast('保存しました') }}
                placeholder="詳しく..."
                style={{ width: '100%', minHeight: 60 }} />
            </div>
            <div className="form-row" style={{ marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label className="form-label">期限</label>
                <input className="input" type="date" value={editingGoal.target_date || ''}
                  onChange={(e) => { setEditingGoal({ ...editingGoal, target_date: e.target.value || null }); updateGoal(editingGoal.id, { target_date: e.target.value || null }) }}
                  style={{ width: '100%' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label">スケール</label>
                <select className="input" value={editingGoal.level}
                  onChange={(e) => { const v = e.target.value as GoalLevel; setEditingGoal({ ...editingGoal, level: v }); updateGoal(editingGoal.id, { level: v }) }}
                  style={{ width: '100%' }}>
                  {GOAL_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.icon} {l.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">夢との紐付け</label>
              <select className="input" value={editingGoal.dream_id || ''}
                onChange={(e) => { const v = e.target.value || null; setEditingGoal({ ...editingGoal, dream_id: v }); updateGoal(editingGoal.id, { dream_id: v }) }}
                style={{ width: '100%' }}>
                <option value="">なし</option>
                {activeDreams.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text2)' }}>進捗</span>
                <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{editingGoal.progress}%</span>
              </div>
              <input type="range" min={0} max={100} step={5} value={editingGoal.progress}
                onChange={(e) => { const v = Number(e.target.value); handleUpdateProgress(editingGoal, v); setEditingGoal({ ...editingGoal, progress: v }) }}
                style={{ width: '100%' }} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
