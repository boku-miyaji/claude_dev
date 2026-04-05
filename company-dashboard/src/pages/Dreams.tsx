import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, PageHeader, Modal, EmptyState } from '@/components/ui'
import { toast } from '@/components/ui/Toast'
import { DREAM_STATUSES } from '@/types/dreams'
import type { DreamStatus } from '@/types/dreams'
import type { Dream } from '@/types/dreams'
import { useDataStore } from '@/stores/data'
import { aiCompletion } from '@/lib/edgeAi'

/* ── Dynamic Categories ── */

interface Category {
  value: string
  label: string
  icon: string
}

/** Derive categories dynamically from existing dreams */
function deriveCategories(dreams: Dream[]): Category[] {
  const catSet = new Set<string>()
  for (const d of dreams) {
    if (d.category) catSet.add(d.category)
  }
  const cats: Category[] = []
  for (const v of catSet) {
    cats.push({ value: v, label: v, icon: getCategoryIcon(v) })
  }
  return cats.sort((a, b) => a.label.localeCompare(b.label))
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
  title: string,
  description: string,
  existingCategories: Category[],
): Promise<{ category: string; isNew: boolean }> {
  const catList = existingCategories.map((c) => `${c.icon} ${c.value}`).join(', ')

  const result = await aiCompletion(
    `以下の「夢」を最適なカテゴリに分類してください。

夢: ${title}
${description ? `説明: ${description}` : ''}

既存カテゴリ: [${catList || 'なし'}]

ルール:
- 既存カテゴリに当てはまるならそのカテゴリ名を返す
- 当てはまらない場合は新しいカテゴリ名を作成して返す（短く、日本語、一般的な名前）
- カテゴリ名のみ返す（説明不要）`,
    { model: 'gpt-5-nano', temperature: 0.2, maxTokens: 50 },
  )

  const category = result.content.trim().replace(/^[「『"']+|[」』"']+$/g, '')
  const isNew = !existingCategories.some((c) => c.value === category)
  return { category, isNew }
}

async function reviewCategories(
  dreams: Dream[],
  currentCategories: Category[],
): Promise<{ newCategories: Record<string, string>; reason: string } | null> {
  if (dreams.length < 3) return null

  const dreamList = dreams.map((d) => `- "${d.title}" → ${d.category}`).join('\n')
  const catList = currentCategories.map((c) => c.value).join(', ')

  const result = await aiCompletion(
    `以下の夢リストとカテゴリ分類を見て、カテゴリ構造を見直すべきか判断してください。

現在のカテゴリ: [${catList}]

夢リスト:
${dreamList}

以下のJSON形式で返してください:
{
  "needs_review": true/false,
  "reason": "見直し理由（不要ならnull）",
  "changes": { "旧カテゴリ名": "新カテゴリ名", ... }
}

見直し基準:
- 1件しかないカテゴリが複数ある → 統合を検討
- 5件以上のカテゴリがある → 分割を検討
- 類似カテゴリがある → 統合
- 見直し不要なら needs_review: false`,
    { model: 'gpt-5-nano', temperature: 0.2, maxTokens: 500, jsonMode: true },
  )

  try {
    const parsed = JSON.parse(result.content)
    if (!parsed.needs_review) return null
    return { newCategories: parsed.changes || {}, reason: parsed.reason || '' }
  } catch {
    return null
  }
}

/* ── Component ── */

export function Dreams() {
  const {
    dreams, goals,
    fetchDreams, fetchGoals,
    addDream, updateDream, deleteDream,
    loading,
  } = useDataStore()

  const [filter, setFilter] = useState<DreamStatus | ''>('')
  const [showAdd, setShowAdd] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [classifying, setClassifying] = useState(false)
  const [reviewing, setReviewing] = useState(false)

  // Add form state
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [suggestedCat, setSuggestedCat] = useState<string | null>(null)
  const [manualCat, setManualCat] = useState<string>('')

  useEffect(() => {
    fetchDreams()
    fetchGoals()
  }, [fetchDreams, fetchGoals])

  // Dynamic categories derived from existing dreams
  const categories = useMemo(() => deriveCategories(dreams), [dreams])
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.value, c])), [categories])

  const detail = useMemo(() => {
    if (!detailId) return null
    return dreams.find((d) => d.id === detailId) ?? null
  }, [detailId, dreams])

  const filtered = useMemo(() => {
    if (!filter) return dreams
    return dreams.filter((d) => d.status === filter)
  }, [dreams, filter])

  const grouped = useMemo(() => {
    const map = new Map<string, typeof dreams>()
    for (const d of filtered) {
      const cat = d.category || 'other'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(d)
    }
    return map
  }, [filtered])

  const stats = useMemo(() => {
    const achieved = dreams.filter((d) => d.status === 'achieved').length
    const inProgress = dreams.filter((d) => d.status === 'in_progress').length
    return { achieved, inProgress, total: dreams.length }
  }, [dreams])

  const linkedGoals = useMemo(() => {
    if (!detail) return []
    return goals.filter((g) => g.dream_id === detail.id)
  }, [detail, goals])

  // Auto-classify when title changes (debounced)
  const runClassify = useCallback(async (title: string, desc: string) => {
    if (!title.trim()) { setSuggestedCat(null); return }
    setClassifying(true)
    try {
      const result = await classifyDream(title, desc, categories)
      setSuggestedCat(result.category)
      if (result.isNew) toast(`新カテゴリ「${result.category}」を提案`)
    } catch {
      setSuggestedCat(null)
    }
    setClassifying(false)
  }, [categories])

  async function handleAddDream() {
    if (!newTitle.trim()) return
    const category = manualCat || suggestedCat || 'other'
    const result = await addDream({
      title: newTitle.trim(),
      description: newDesc.trim() || null,
      category,
    })
    if (result) {
      setNewTitle('')
      setNewDesc('')
      setSuggestedCat(null)
      setManualCat('')
      setShowAdd(false)
      toast(`「${category}」に分類して追加しました`)
    }
  }

  async function handleReviewCategories() {
    setReviewing(true)
    try {
      const result = await reviewCategories(dreams, categories)
      if (!result) {
        toast('現在のカテゴリ構造は適切です')
        setReviewing(false)
        return
      }

      const changes = result.newCategories
      const entries = Object.entries(changes)
      if (entries.length === 0) {
        toast('変更なし: ' + result.reason)
        setReviewing(false)
        return
      }

      // Apply changes
      let updated = 0
      for (const dream of dreams) {
        const newCat = changes[dream.category]
        if (newCat) {
          await updateDream(dream.id, { category: newCat })
          updated++
        }
      }
      await fetchDreams()
      toast(`${result.reason} — ${updated}件を再分類しました`)
    } catch (e) {
      toast('カテゴリ見直しに失敗しました')
    }
    setReviewing(false)
  }

  async function handleUpdateStatus(dreamId: string, title: string, status: DreamStatus) {
    await updateDream(dreamId, {
      status,
      achieved_at: status === 'achieved' ? new Date().toISOString() : null,
    })
    setDetailId(null)
    const label = DREAM_STATUSES.find((s) => s.value === status)?.label || status
    toast(`「${title}」を${label}に変更しました`)
  }

  async function handleDeleteDream(dreamId: string, title: string) {
    await deleteDream(dreamId)
    setDetailId(null)
    toast(`「${title}」を削除しました`)
  }

  const isLoading = loading.dreams

  if (isLoading && dreams.length === 0) {
    return (
      <div className="page">
        <PageHeader title="100の夢リスト" />
        <div style={{ color: 'var(--text3)' }}>Loading...</div>
      </div>
    )
  }

  // Sort categories by item count (desc)
  const sortedCats = [...grouped.entries()].sort((a, b) => b[1].length - a[1].length)

  return (
    <div className="page">
      <PageHeader
        title="100の夢リスト"
        description="いつか叶えたい夢を自由に書き出す場所。AIが自動でカテゴリ分類。"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            {dreams.length >= 3 && (
              <button
                className="btn btn-g btn-sm"
                onClick={handleReviewCategories}
                disabled={reviewing}
              >
                {reviewing ? '分析中...' : 'カテゴリ見直し'}
              </button>
            )}
            <button className="btn btn-p btn-sm" onClick={() => setShowAdd(true)}>
              + 新しい夢を追加
            </button>
          </div>
        }
      />

      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 12, color: 'var(--text2)' }}>
        <span>達成: <strong>{stats.achieved}</strong></span>
        <span>進行中: <strong>{stats.inProgress}</strong></span>
        <span>全: <strong>{stats.total}</strong></span>
        <span>カテゴリ: <strong>{categories.length}</strong></span>
      </div>

      {/* Status Filters */}
      <div className="filter-bar">
        {[
          { value: '' as const, label: '全て' },
          ...DREAM_STATUSES,
        ].map((s) => (
          <button
            key={s.value}
            className={`btn btn-sm ${filter === s.value ? 'btn-p' : 'btn-g'}`}
            onClick={() => setFilter(s.value as DreamStatus | '')}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Grouped by dynamic category */}
      {dreams.length === 0 ? (
        <Card>
          <EmptyState
            icon="🌟"
            message="まだ夢がありません。最初の夢を追加してみましょう。"
            actionLabel="夢を追加"
            onAction={() => setShowAdd(true)}
          />
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sortedCats.map(([catValue, items]) => {
            if (items.length === 0) return null
            const catInfo = categoryMap.get(catValue)
            const icon = catInfo?.icon || getCategoryIcon(catValue)
            return (
              <div key={catValue}>
                <div className="section-title" style={{ marginBottom: 8 }}>
                  {icon} {catValue} ({items.length}件)
                </div>
                <Card>
                  {items.map((d) => (
                    <div
                      key={d.id}
                      style={{
                        padding: '10px 0',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        cursor: 'pointer',
                        fontSize: 13,
                      }}
                      onClick={() => setDetailId(d.id)}
                    >
                      <span style={{ fontSize: 14 }}>
                        {d.status === 'achieved' ? '✅' : d.status === 'in_progress' ? '🔄' : d.status === 'paused' ? '⏸' : '☐'}
                      </span>
                      <span style={{
                        flex: 1,
                        textDecoration: d.status === 'achieved' ? 'line-through' : 'none',
                        color: d.status === 'achieved' ? 'var(--text3)' : 'var(--text)',
                        fontWeight: 500,
                      }}>
                        {d.title}
                      </span>
                    </div>
                  ))}
                </Card>
              </div>
            )
          })}
        </div>
      )}

      {/* Add modal */}
      <Modal open={showAdd} onClose={() => { setShowAdd(false); setSuggestedCat(null); setManualCat('') }} title="新しい夢を追加">
        <div style={{ marginBottom: 12 }}>
          <label className="form-label">タイトル</label>
          <input
            className="input"
            placeholder="あなたの夢は?"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onBlur={() => runClassify(newTitle, newDesc)}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label className="form-label">説明 (任意)</label>
          <textarea
            className="input"
            placeholder="詳しく書いてみてください..."
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            onBlur={() => newTitle.trim() && runClassify(newTitle, newDesc)}
            style={{ minHeight: 60 }}
          />
        </div>
        {/* AI category suggestion + manual override */}
        <div style={{ marginBottom: 12 }}>
          <label className="form-label">カテゴリ</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {classifying ? (
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>AI分類中...</span>
            ) : suggestedCat ? (
              <span className="tag tag-co" style={{ fontSize: 12 }}>
                {getCategoryIcon(suggestedCat)} {suggestedCat}
              </span>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>入力後に自動分類</span>
            )}
            <input
              className="input"
              placeholder="手動で変更"
              value={manualCat}
              onChange={(e) => setManualCat(e.target.value)}
              style={{ flex: 1, fontSize: 12, padding: '4px 8px' }}
            />
          </div>
        </div>
        <button className="btn btn-p" style={{ width: '100%' }} onClick={handleAddDream} disabled={!newTitle.trim() || classifying}>
          追加する
        </button>
      </Modal>

      {/* Detail modal */}
      <Modal
        open={!!detail}
        onClose={() => setDetailId(null)}
        title={detail?.title || ''}
        footer={
          detail ? (
            <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'space-between' }}>
              <button className="btn btn-d btn-sm" onClick={() => handleDeleteDream(detail.id, detail.title)}>削除</button>
              <div style={{ display: 'flex', gap: 8 }}>
                {DREAM_STATUSES.filter((s) => s.value !== detail.status).map((s) => (
                  <button
                    key={s.value}
                    className={`btn btn-sm ${s.value === 'achieved' ? 'btn-p' : 'btn-g'}`}
                    onClick={() => handleUpdateStatus(detail.id, detail.title, s.value)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          ) : undefined
        }
      >
        {detail && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                className="input"
                value={detail.category}
                onChange={async (e) => {
                  await updateDream(detail.id, { category: e.target.value })
                  toast(`カテゴリを「${e.target.value}」に変更しました`)
                }}
                style={{ width: 'auto', maxWidth: 160, fontSize: 12, padding: '4px 8px' }}
              />
              <span className={`tag ${detail.status === 'achieved' ? 'tag-done' : detail.status === 'in_progress' ? 'tag-in_progress' : 'tag-open'}`}>
                {DREAM_STATUSES.find((s) => s.value === detail.status)?.label}
              </span>
            </div>
            {detail.description && (
              <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 12 }}>
                {detail.description}
              </p>
            )}

            {linkedGoals.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 8 }}>
                  紐づく目標 ({linkedGoals.length}件)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {linkedGoals.map((g) => (
                    <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: g.status === 'achieved' ? 'var(--green)' : 'var(--text2)', fontWeight: 500, flex: 1 }}>
                        {g.status === 'achieved' ? '✅' : '○'} {g.title}
                      </span>
                      <div style={{ width: 50 }}>
                        <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${g.progress}%`,
                            background: g.progress >= 100 ? 'var(--green)' : 'var(--accent)',
                            borderRadius: 2,
                          }} />
                        </div>
                      </div>
                      <span style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', width: 28, textAlign: 'right' }}>
                        {g.progress}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
              作成: {new Date(detail.created_at).toLocaleDateString('ja-JP')}
              {detail.achieved_at && (
                <span> / 達成: {new Date(detail.achieved_at).toLocaleDateString('ja-JP')}</span>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
