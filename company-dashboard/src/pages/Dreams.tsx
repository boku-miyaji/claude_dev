import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, PageHeader, Modal, EmptyState } from '@/components/ui'
import { toast } from '@/components/ui/Toast'
import { DREAM_STATUSES } from '@/types/dreams'
import type { Dream } from '@/types/dreams'
import { GOAL_LEVELS, GOAL_STATUSES } from '@/types/goals'
import type { Goal, GoalLevel, GoalStatus } from '@/types/goals'
import { useDataStore } from '@/stores/data'
import { supabase } from '@/lib/supabase'
import { aiCompletion } from '@/lib/edgeAi'

function fmtYen(n: number): string { return '¥' + n.toLocaleString() }

/* ── Dynamic Categories ── */

interface Category { value: string; label: string; icon: string }

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

async function classifyItem(title: string, description: string, existingCategories: Category[]): Promise<{ category: string; isNew: boolean }> {
  const catList = existingCategories.map((c) => `${c.icon} ${c.value}`).join(', ')
  const result = await aiCompletion(
    `以下を最適なカテゴリに分類。既存: [${catList || 'なし'}]。当てはまらなければ新カテゴリ作成（短く日本語）。カテゴリ名のみ返す。\n\n「${title}」${description ? `（${description}）` : ''}`,
    { model: 'gpt-5-nano', temperature: 0.2, maxTokens: 50 },
  )
  const category = result.content.trim().replace(/^[「『"']+|[」』"']+$/g, '')
  return { category, isNew: !existingCategories.some((c) => c.value === category) }
}

async function reviewCategories(dreams: Dream[], cats: Category[]): Promise<{ changes: Record<string, string>; reason: string } | null> {
  if (dreams.length < 3) return null
  const result = await aiCompletion(
    `カテゴリ見直し。現在: [${cats.map((c) => c.value).join(', ')}]\n夢:\n${dreams.map((d) => `- "${d.title}" → ${d.category}`).join('\n')}\n\nJSON: {"needs_review":bool,"reason":"","changes":{"旧":"新"}}`,
    { model: 'gpt-5-nano', temperature: 0.2, maxTokens: 500, jsonMode: true },
  )
  try {
    const p = JSON.parse(result.content)
    return p.needs_review ? { changes: p.changes || {}, reason: p.reason || '' } : null
  } catch { return null }
}

/* ── Unified Item type ── */

interface WishItem {
  id: string
  title: string
  description: string | null
  amount: number
  url: string | null
  category: string
  priority: string
  status: string
  created_at: string
}

interface UnifiedItem {
  kind: 'dream' | 'goal' | 'wish'
  id: string
  title: string
  description: string | null
  category: string
  status: string
  progress?: number
  target_date?: string | null
  level?: GoalLevel
  dream_id?: string | null
  achieved_at?: string | null
  created_at: string
  amount?: number
  url?: string | null
}

function unifyItems(dreams: Dream[], goals: Goal[], wishes: WishItem[]): UnifiedItem[] {
  const items: UnifiedItem[] = []
  for (const d of dreams) {
    items.push({ kind: 'dream', id: d.id, title: d.title, description: d.description, category: d.category || 'other', status: d.status, achieved_at: d.achieved_at, created_at: d.created_at })
  }
  for (const g of goals) {
    const linkedDream = g.dream_id ? dreams.find((d) => d.id === g.dream_id) : null
    items.push({ kind: 'goal', id: g.id, title: g.title, description: g.description, category: linkedDream?.category || 'goal', status: g.status, progress: g.progress, target_date: g.target_date, level: g.level, dream_id: g.dream_id, achieved_at: g.achieved_at, created_at: g.created_at })
  }
  for (const w of wishes) {
    items.push({ kind: 'wish', id: w.id, title: w.title, description: w.description, category: w.category || 'ほしい物', status: w.status === 'purchased' ? 'achieved' : w.status === 'dropped' ? 'paused' : 'active', amount: w.amount, url: w.url, created_at: w.created_at })
  }
  return items
}

/* ── Component ── */

export function Dreams() {
  const {
    dreams, goals,
    fetchDreams, fetchGoals,
    addDream, updateDream, deleteDream,
    addGoal, updateGoal, deleteGoal,
    loading,
  } = useDataStore()

  const [wishlist, setWishlist] = useState<WishItem[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [detailDream, setDetailDream] = useState<Dream | null>(null)
  const [detailGoal, setDetailGoal] = useState<Goal | null>(null)
  const [detailWish, setDetailWish] = useState<WishItem | null>(null)
  const [classifying, setClassifying] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [kindFilter, setKindFilter] = useState<'all' | 'dream' | 'goal' | 'wish'>('all')

  // Add form
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [suggestedCat, setSuggestedCat] = useState<string | null>(null)
  const [manualCat, setManualCat] = useState('')
  const [addKind, setAddKind] = useState<'dream' | 'goal' | 'wish'>('dream')
  const [goalLevel, setGoalLevel] = useState<GoalLevel>('yearly')
  const [goalYear, setGoalYear] = useState(String(new Date().getFullYear()))
  const [goalMonth, setGoalMonth] = useState('')
  const [goalDay, setGoalDay] = useState('')
  const [goalDreamId, setGoalDreamId] = useState('')
  // Wish add form
  const [wishAmount, setWishAmount] = useState('')
  const [wishUrl, setWishUrl] = useState('')

  const loadWishlist = useCallback(async () => {
    const { data } = await supabase.from('wishlist').select('*').in('status', ['want', 'considering']).order('created_at', { ascending: false })
    setWishlist((data as WishItem[]) || [])
  }, [])

  useEffect(() => { fetchDreams(); fetchGoals(); loadWishlist() }, [fetchDreams, fetchGoals, loadWishlist])

  const categories = useMemo(() => deriveCategories(dreams), [dreams])
  const activeDreams = useMemo(() => dreams.filter((d) => d.status === 'active' || d.status === 'in_progress'), [dreams])

  const allItems = useMemo(() => unifyItems(dreams, goals, wishlist), [dreams, goals, wishlist])

  const filtered = useMemo(() => {
    return allItems.filter((item) => {
      if (kindFilter === 'dream' && item.kind !== 'dream') return false
      if (kindFilter === 'goal' && item.kind !== 'goal') return false
      if (kindFilter === 'wish' && item.kind !== 'wish') return false
      if (statusFilter && item.status !== statusFilter) return false
      return true
    })
  }, [allItems, kindFilter, statusFilter])

  const grouped = useMemo(() => {
    const map = new Map<string, UnifiedItem[]>()
    for (const item of filtered) {
      if (!map.has(item.category)) map.set(item.category, [])
      map.get(item.category)!.push(item)
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [filtered])

  const stats = useMemo(() => ({
    dreams: dreams.length,
    goals: goals.length,
    wishes: wishlist.length,
    wishTotal: wishlist.reduce((s, w) => s + w.amount, 0),
    achieved: allItems.filter((i) => i.status === 'achieved').length,
  }), [dreams, goals, wishlist, allItems])

  // Linked goals for dream detail
  const linkedGoals = useMemo(() => {
    if (!detailDream) return []
    return goals.filter((g) => g.dream_id === detailDream.id)
  }, [detailDream, goals])

  const runClassify = useCallback(async (title: string, desc: string) => {
    if (!title.trim()) { setSuggestedCat(null); return }
    setClassifying(true)
    try {
      const r = await classifyItem(title, desc, categories)
      setSuggestedCat(r.category)
      if (r.isNew) toast(`新カテゴリ「${r.category}」を提案`)
    } catch { setSuggestedCat(null) }
    setClassifying(false)
  }, [categories])

  function buildTargetDate(): string | null {
    if (!goalYear) return null
    if (goalLevel === 'life') return null
    if (goalLevel === 'yearly') return `${goalYear}-12-31`
    if (goalLevel === 'quarterly' || goalLevel === 'monthly') {
      const m = goalMonth || '12'
      const lastDay = new Date(Number(goalYear), Number(m), 0).getDate()
      return `${goalYear}-${m.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    }
    if (goalDay) return `${goalYear}-${(goalMonth || '01').padStart(2, '0')}-${goalDay.padStart(2, '0')}`
    if (goalMonth) {
      const lastDay = new Date(Number(goalYear), Number(goalMonth), 0).getDate()
      return `${goalYear}-${goalMonth.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    }
    return `${goalYear}-12-31`
  }

  function resetForm() {
    setNewTitle(''); setNewDesc(''); setSuggestedCat(null); setManualCat('')
    setAddKind('dream'); setGoalLevel('yearly'); setGoalYear(String(new Date().getFullYear()))
    setGoalMonth(''); setGoalDay(''); setGoalDreamId(''); setWishAmount(''); setWishUrl('')
  }

  async function handleAdd() {
    if (!newTitle.trim()) return

    if (addKind === 'goal') {
      const result = await addGoal({
        title: newTitle.trim(), description: newDesc.trim() || null,
        level: goalLevel, target_date: buildTargetDate(), dream_id: goalDreamId || null,
      })
      if (result) { resetForm(); setShowAdd(false); toast('目標を追加しました') }
    } else if (addKind === 'wish') {
      const { error } = await supabase.from('wishlist').insert({
        title: newTitle.trim(), description: newDesc.trim() || null,
        amount: parseInt(wishAmount) || 0, url: wishUrl.trim() || null,
        category: manualCat || suggestedCat || 'other',
      })
      if (!error) { resetForm(); setShowAdd(false); loadWishlist(); toast('ほしい物を追加しました') }
    } else {
      const category = manualCat || suggestedCat || 'other'
      const result = await addDream({ title: newTitle.trim(), description: newDesc.trim() || null, category })
      if (result) { resetForm(); setShowAdd(false); toast(`「${category}」に追加しました`) }
    }
  }

  async function handleReviewCategories() {
    setReviewing(true)
    try {
      const result = await reviewCategories(dreams, categories)
      if (!result) { toast('現在のカテゴリ構造は適切です'); setReviewing(false); return }
      const entries = Object.entries(result.changes)
      if (entries.length === 0) { toast('変更なし'); setReviewing(false); return }
      let updated = 0
      for (const dream of dreams) {
        const newCat = result.changes[dream.category]
        if (newCat) { await updateDream(dream.id, { category: newCat }); updated++ }
      }
      await fetchDreams()
      toast(`${result.reason} — ${updated}件を再分類`)
    } catch { toast('失敗しました') }
    setReviewing(false)
  }

  function openItem(item: UnifiedItem) {
    if (item.kind === 'dream') {
      const d = dreams.find((x) => x.id === item.id)
      if (d) setDetailDream(d)
    } else if (item.kind === 'goal') {
      const g = goals.find((x) => x.id === item.id)
      if (g) setDetailGoal(g)
    } else if (item.kind === 'wish') {
      const w = wishlist.find((x) => x.id === item.id)
      if (w) setDetailWish(w)
    }
  }

  async function handleGoalStatusChange(goal: Goal, newStatus: GoalStatus) {
    await updateGoal(goal.id, {
      status: newStatus,
      achieved_at: newStatus === 'achieved' ? new Date().toISOString() : null,
      progress: newStatus === 'achieved' ? 100 : goal.progress,
    })
    if (newStatus === 'achieved' && goal.dream_id) {
      const linked = goals.filter((g) => g.dream_id === goal.dream_id)
      if (linked.every((g) => g.id === goal.id || g.status === 'achieved')) {
        await updateDream(goal.dream_id, { status: 'achieved', achieved_at: new Date().toISOString() })
        toast('紐づく夢も達成！')
      }
    }
    toast(`${GOAL_STATUSES.find((s) => s.value === newStatus)?.label}に変更`)
  }

  const isLoading = loading.dreams || loading.goals
  if (isLoading && dreams.length === 0 && goals.length === 0) {
    return <div className="page"><PageHeader title="Dreams & Goals" /><div style={{ color: 'var(--text3)' }}>Loading...</div></div>
  }

  const todayStr = new Date().toISOString().substring(0, 10)

  return (
    <div className="page">
      <PageHeader
        title="Dreams & Goals"
        description="期限なし = 夢。期限あり = 目標。"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            {dreams.length >= 3 && (
              <button className="btn btn-g btn-sm" onClick={handleReviewCategories} disabled={reviewing}>
                {reviewing ? '分析中...' : 'カテゴリ見直し'}
              </button>
            )}
            <button className="btn btn-p btn-sm" onClick={() => setShowAdd(true)}>+ 追加</button>
          </div>
        }
      />

      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 12, color: 'var(--text2)' }}>
        <span>夢: <strong>{stats.dreams}</strong></span>
        <span>目標: <strong>{stats.goals}</strong></span>
        {stats.wishes > 0 && <span>ほしい物: <strong>{stats.wishes}件 ({fmtYen(stats.wishTotal)})</strong></span>}
        <span>達成: <strong>{stats.achieved}</strong></span>
      </div>

      {/* Filters */}
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <button className={`btn btn-sm ${kindFilter === 'all' ? 'btn-p' : 'btn-g'}`} onClick={() => setKindFilter('all')}>全て</button>
        <button className={`btn btn-sm ${kindFilter === 'dream' ? 'btn-p' : 'btn-g'}`} onClick={() => setKindFilter('dream')}>夢のみ</button>
        <button className={`btn btn-sm ${kindFilter === 'goal' ? 'btn-p' : 'btn-g'}`} onClick={() => setKindFilter('goal')}>目標のみ</button>
        <button className={`btn btn-sm ${kindFilter === 'wish' ? 'btn-p' : 'btn-g'}`} onClick={() => setKindFilter('wish')}>ほしい物</button>
        <span style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
        <button className={`btn btn-sm ${statusFilter === '' ? 'btn-p' : 'btn-g'}`} onClick={() => setStatusFilter('')}>All</button>
        <button className={`btn btn-sm ${statusFilter === 'active' ? 'btn-p' : 'btn-g'}`} onClick={() => setStatusFilter('active')}>未着手</button>
        <button className={`btn btn-sm ${statusFilter === 'in_progress' ? 'btn-p' : 'btn-g'}`} onClick={() => setStatusFilter('in_progress')}>進行中</button>
        <button className={`btn btn-sm ${statusFilter === 'achieved' ? 'btn-p' : 'btn-g'}`} onClick={() => setStatusFilter('achieved')}>達成</button>
      </div>

      {/* Unified List */}
      {allItems.length === 0 ? (
        <Card><EmptyState icon="🌟" message="夢や目標を追加してみましょう。" actionLabel="追加" onAction={() => setShowAdd(true)} /></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {grouped.map(([catValue, items]) => (
            <div key={catValue}>
              <div className="section-title" style={{ marginBottom: 8 }}>
                {getCategoryIcon(catValue)} {catValue} ({items.length}件)
              </div>
              <Card>
                {items.map((item) => {
                  const isDone = item.status === 'achieved'
                  const isOverdue = item.kind === 'goal' && item.target_date && item.target_date < todayStr && !isDone
                  return (
                    <div key={`${item.kind}-${item.id}`}
                      style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}
                      onClick={() => openItem(item)}>
                      <span style={{ fontSize: 14 }}>
                        {isDone ? '✅' : item.status === 'in_progress' ? '🔄' : item.status === 'paused' ? '⏸' : item.kind === 'goal' ? '🎯' : item.kind === 'wish' ? '🛒' : '☐'}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 500, textDecoration: isDone ? 'line-through' : 'none', color: isDone ? 'var(--text3)' : 'var(--text)' }}>
                            {item.title}
                          </span>
                          {item.kind === 'goal' && <span style={{ fontSize: 9, color: 'var(--accent2)', fontFamily: 'var(--mono)', background: 'var(--accent-bg)', padding: '1px 5px', borderRadius: 3 }}>目標</span>}
                          {item.kind === 'wish' && <span style={{ fontSize: 9, color: 'var(--amber)', fontFamily: 'var(--mono)', background: 'var(--amber-bg)', padding: '1px 5px', borderRadius: 3 }}>ほしい物</span>}
                          {item.kind === 'wish' && item.amount ? <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--mono)', color: (item.amount ?? 0) >= 100000 ? 'var(--red)' : (item.amount ?? 0) >= 30000 ? 'var(--amber)' : 'var(--text2)' }}>{fmtYen(item.amount)}</span> : null}
                          {isOverdue && <span style={{ fontSize: 9, color: 'var(--red)', fontWeight: 600 }}>期限超過</span>}
                        </div>
                        {item.kind === 'goal' && item.target_date && (
                          <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                            {GOAL_LEVELS.find((l) => l.value === item.level)?.icon} {item.target_date}
                          </span>
                        )}
                      </div>
                      {item.kind === 'goal' && item.progress !== undefined && (
                        <div style={{ width: 50, flexShrink: 0 }}>
                          <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${item.progress}%`, background: item.progress >= 100 ? 'var(--green)' : 'var(--accent)', borderRadius: 2 }} />
                          </div>
                          <div style={{ fontSize: 9, color: 'var(--text3)', textAlign: 'right', fontFamily: 'var(--mono)' }}>{item.progress}%</div>
                        </div>
                      )}
                      {item.kind === 'dream' && goals.some((g) => g.dream_id === item.id) && (
                        <span style={{ fontSize: 10, color: 'var(--accent2)', fontFamily: 'var(--mono)' }}>
                          {goals.filter((g) => g.dream_id === item.id && g.status === 'achieved').length}/{goals.filter((g) => g.dream_id === item.id).length}
                        </span>
                      )}
                    </div>
                  )
                })}
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* ════════ Add Modal ════════ */}
      <Modal open={showAdd} onClose={() => { setShowAdd(false); resetForm() }} title="新しく追加">
        {/* Kind selector */}
        <div className="filter-bar" style={{ marginBottom: 16 }}>
          {([['dream', '☐ 夢'], ['goal', '🎯 目標'], ['wish', '🛒 ほしい物']] as const).map(([k, label]) => (
            <button key={k} className={`btn btn-sm ${addKind === k ? 'btn-p' : 'btn-g'}`}
              onClick={() => setAddKind(k)} type="button">{label}</button>
          ))}
        </div>

        <div style={{ marginBottom: 12 }}>
          <label className="form-label">タイトル</label>
          <input className="input" placeholder={addKind === 'wish' ? '何がほしい？' : addKind === 'goal' ? '何を達成する？' : 'やりたいこと'}
            value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            onBlur={() => addKind === 'dream' && runClassify(newTitle, newDesc)} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label className="form-label">説明 (任意)</label>
          <textarea className="input" placeholder="詳しく..." value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
            onBlur={() => addKind === 'dream' && newTitle.trim() && runClassify(newTitle, newDesc)} style={{ minHeight: 50 }} />
        </div>

        {/* ── Wish fields ── */}
        {addKind === 'wish' && (
          <>
            <div className="form-row" style={{ marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label className="form-label">金額（円）</label>
                <input className="input" type="number" placeholder="120000" value={wishAmount} onChange={(e) => setWishAmount(e.target.value)} style={{ width: '100%' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label">URL (任意)</label>
                <input className="input" placeholder="商品リンク" value={wishUrl} onChange={(e) => setWishUrl(e.target.value)} style={{ width: '100%' }} />
              </div>
            </div>
          </>
        )}

        {/* ── Goal fields ── */}
        {addKind === 'goal' && (
          <>
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">スケール</label>
              <div className="filter-bar" style={{ marginBottom: 0 }}>
                {GOAL_LEVELS.filter((l) => l.value !== 'life').map((l) => (
                  <button key={l.value} className={`btn btn-sm ${goalLevel === l.value ? 'btn-p' : 'btn-g'}`}
                    onClick={() => setGoalLevel(l.value)} type="button">{l.icon} {l.label}</button>
                ))}
              </div>
            </div>
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
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">夢との紐付け (任意)</label>
              <select className="input" value={goalDreamId} onChange={(e) => setGoalDreamId(e.target.value)} style={{ width: '100%' }}>
                <option value="">なし</option>
                {activeDreams.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
            </div>
          </>
        )}

        {/* ── Dream fields ── */}
        {addKind === 'dream' && (
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
        )}

        <button className="btn btn-p" style={{ width: '100%' }} onClick={handleAdd}
          disabled={!newTitle.trim() || (addKind === 'dream' && classifying)}>
          {addKind === 'goal' ? '目標を追加' : addKind === 'wish' ? 'ほしい物を追加' : '夢を追加'}
        </button>
      </Modal>

      {/* ════════ Dream Detail ════════ */}
      <Modal open={!!detailDream} onClose={() => setDetailDream(null)} title="夢の詳細"
        footer={detailDream ? (
          <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'space-between' }}>
            <button className="btn btn-d btn-sm" onClick={() => { deleteDream(detailDream.id); setDetailDream(null); toast('削除しました') }}>削除</button>
            <div style={{ display: 'flex', gap: 8 }}>
              {DREAM_STATUSES.filter((s) => s.value !== detailDream.status).map((s) => (
                <button key={s.value} className={`btn btn-sm ${s.value === 'achieved' ? 'btn-p' : 'btn-g'}`}
                  onClick={() => { updateDream(detailDream.id, { status: s.value, achieved_at: s.value === 'achieved' ? new Date().toISOString() : null }); setDetailDream(null); toast(`${s.label}に変更`) }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ) : undefined}>
        {detailDream && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">タイトル</label>
              <input className="input" value={detailDream.title}
                onChange={(e) => updateDream(detailDream.id, { title: e.target.value })}
                onBlur={() => toast('保存しました')} style={{ width: '100%', fontSize: 14, fontWeight: 500 }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">説明</label>
              <textarea className="input" value={detailDream.description || ''}
                onChange={(e) => updateDream(detailDream.id, { description: e.target.value || null })}
                onBlur={() => toast('保存しました')} placeholder="詳しく..." style={{ width: '100%', minHeight: 60 }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">カテゴリ</label>
              <input className="input" value={detailDream.category}
                onChange={(e) => updateDream(detailDream.id, { category: e.target.value })}
                style={{ width: 'auto', maxWidth: 200, fontSize: 12, padding: '4px 8px' }} />
            </div>
            {linkedGoals.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div className="form-label">紐づく目標 ({linkedGoals.length}件)</div>
                {linkedGoals.map((g) => (
                  <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: g.status === 'achieved' ? 'var(--green)' : 'var(--text2)', fontWeight: 500, flex: 1 }}>
                      {g.status === 'achieved' ? '✅' : '🎯'} {g.title}
                    </span>
                    <span style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{g.progress}%</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
              作成: {new Date(detailDream.created_at).toLocaleDateString('ja-JP')}
              {detailDream.achieved_at && <span> / 達成: {new Date(detailDream.achieved_at).toLocaleDateString('ja-JP')}</span>}
            </div>
          </div>
        )}
      </Modal>

      {/* ════════ Goal Detail ════════ */}
      <Modal open={!!detailGoal} onClose={() => setDetailGoal(null)} title="目標の詳細"
        footer={detailGoal ? (
          <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'space-between' }}>
            <button className="btn btn-d btn-sm" onClick={() => { deleteGoal(detailGoal.id); setDetailGoal(null); toast('削除しました') }}>削除</button>
            <div style={{ display: 'flex', gap: 6 }}>
              {GOAL_STATUSES.filter((s) => s.value !== detailGoal.status).map((s) => (
                <button key={s.value} className={`btn btn-sm ${s.value === 'achieved' ? 'btn-p' : 'btn-g'}`}
                  onClick={() => { handleGoalStatusChange(detailGoal, s.value); setDetailGoal(null) }}>{s.label}</button>
              ))}
            </div>
          </div>
        ) : undefined}>
        {detailGoal && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">タイトル</label>
              <input className="input" value={detailGoal.title}
                onChange={(e) => setDetailGoal({ ...detailGoal, title: e.target.value })}
                onBlur={() => { updateGoal(detailGoal.id, { title: detailGoal.title }); toast('保存しました') }}
                style={{ width: '100%', fontSize: 14, fontWeight: 500 }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">説明</label>
              <textarea className="input" value={detailGoal.description || ''}
                onChange={(e) => setDetailGoal({ ...detailGoal, description: e.target.value || null })}
                onBlur={() => { updateGoal(detailGoal.id, { description: detailGoal.description }); toast('保存しました') }}
                placeholder="詳しく..." style={{ width: '100%', minHeight: 60 }} />
            </div>
            <div className="form-row" style={{ marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label className="form-label">期限</label>
                <input className="input" type="date" value={detailGoal.target_date || ''}
                  onChange={(e) => { setDetailGoal({ ...detailGoal, target_date: e.target.value || null }); updateGoal(detailGoal.id, { target_date: e.target.value || null }) }}
                  style={{ width: '100%' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label">スケール</label>
                <select className="input" value={detailGoal.level}
                  onChange={(e) => { const v = e.target.value as GoalLevel; setDetailGoal({ ...detailGoal, level: v }); updateGoal(detailGoal.id, { level: v }) }}
                  style={{ width: '100%' }}>
                  {GOAL_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.icon} {l.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">夢との紐付け</label>
              <select className="input" value={detailGoal.dream_id || ''}
                onChange={(e) => { const v = e.target.value || null; setDetailGoal({ ...detailGoal, dream_id: v }); updateGoal(detailGoal.id, { dream_id: v }) }}
                style={{ width: '100%' }}>
                <option value="">なし</option>
                {activeDreams.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text2)' }}>進捗</span>
                <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{detailGoal.progress}%</span>
              </div>
              <input type="range" min={0} max={100} step={5} value={detailGoal.progress}
                onChange={(e) => { const v = Number(e.target.value); updateGoal(detailGoal.id, { progress: v, ...(v >= 100 ? { status: 'achieved', achieved_at: new Date().toISOString() } : {}) }); setDetailGoal({ ...detailGoal, progress: v }) }}
                style={{ width: '100%' }} />
            </div>
          </div>
        )}
      </Modal>

      {/* ════════ Wish Detail ════════ */}
      <Modal open={!!detailWish} onClose={() => setDetailWish(null)} title="ほしい物の詳細"
        footer={detailWish ? (
          <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'space-between' }}>
            <button className="btn btn-d btn-sm" onClick={async () => { await supabase.from('wishlist').delete().eq('id', detailWish.id); setDetailWish(null); loadWishlist(); toast('削除しました') }}>削除</button>
            <div style={{ display: 'flex', gap: 6 }}>
              {detailWish.status !== 'purchased' && (
                <button className="btn btn-p btn-sm" onClick={async () => {
                  await supabase.from('wishlist').update({ status: 'purchased', purchased_at: new Date().toISOString() }).eq('id', detailWish.id)
                  setDetailWish(null); loadWishlist(); toast('購入済みにしました')
                }}>購入済み</button>
              )}
              {detailWish.status !== 'dropped' && (
                <button className="btn btn-g btn-sm" onClick={async () => {
                  await supabase.from('wishlist').update({ status: 'dropped' }).eq('id', detailWish.id)
                  setDetailWish(null); loadWishlist(); toast('見送りにしました')
                }}>見送り</button>
              )}
            </div>
          </div>
        ) : undefined}>
        {detailWish && (
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--mono)', marginBottom: 12, color: detailWish.amount >= 100000 ? 'var(--red)' : detailWish.amount >= 30000 ? 'var(--amber)' : 'var(--text)' }}>
              {fmtYen(detailWish.amount)}
            </div>
            <div style={{ marginBottom: 12, fontSize: 16, fontWeight: 500 }}>{detailWish.title}</div>
            {detailWish.description && <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 12 }}>{detailWish.description}</p>}
            {detailWish.url && (
              <a href={detailWish.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--accent2)', display: 'block', marginBottom: 12 }}>
                商品リンクを開く →
              </a>
            )}
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>
              カテゴリ: {detailWish.category} · 優先度: {detailWish.priority === 'high' ? '高' : detailWish.priority === 'low' ? '低' : '中'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
              Finance → ほしい物タブでも管理できます
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
