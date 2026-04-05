import { useEffect, useMemo, useState } from 'react'
import { Card, PageHeader, Modal, EmptyState } from '@/components/ui'
import { toast } from '@/components/ui/Toast'
import { DREAM_CATEGORIES, DREAM_STATUSES } from '@/types/dreams'
import type { DreamCategory, DreamStatus } from '@/types/dreams'
import { useDataStore } from '@/stores/data'

const CATEGORY_MAP = new Map(DREAM_CATEGORIES.map((c) => [c.value, c]))

/** Auto-classify dream category from title + description using keyword matching */
function autoClassify(title: string, desc: string): DreamCategory {
  const text = `${title} ${desc}`.toLowerCase()
  const rules: [DreamCategory, RegExp][] = [
    ['career', /仕事|キャリア|転職|昇進|起業|経営|ビジネス|売上|事業|副業|独立|会社|プロジェクト|案件|営業|コンサル/],
    ['financial', /お金|貯金|投資|年収|資産|収入|不動産|株|万円|億|ローン|節税|financial|salary|income/],
    ['travel', /旅行|旅|海外|国内|観光|世界一周|visit|travel|ヨーロッパ|アジア|アメリカ|ハワイ|沖縄|北海道/],
    ['skill', /スキル|勉強|学習|資格|英語|プログラミング|読書|learn|study|技術|言語|大学|講座|セミナー|開発/],
    ['health', /健康|運動|ダイエット|筋トレ|ジム|マラソン|体重|睡眠|ヨガ|体力|禁煙|health|fitness|走/],
    ['relationship', /家族|友人|結婚|パートナー|子ども|親|恋人|人間関係|コミュニティ|仲間|出会い|友達/],
    ['creative', /作品|音楽|絵|写真|動画|ブログ|本|小説|映画|デザイン|アート|YouTube|創作|制作|ポッドキャスト/],
    ['experience', /体験|挑戦|イベント|ライブ|フェス|スカイダイビング|ボランティア|経験|初めて|やってみ/],
  ]
  for (const [cat, pattern] of rules) {
    if (pattern.test(text)) return cat
  }
  return 'other'
}

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

  // Add form state
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const autoCategory = useMemo(() => autoClassify(newTitle, newDesc), [newTitle, newDesc])

  useEffect(() => {
    fetchDreams()
    fetchGoals()
  }, [fetchDreams, fetchGoals])

  const detail = useMemo(() => {
    if (!detailId) return null
    return dreams.find((d) => d.id === detailId) ?? null
  }, [detailId, dreams])

  const filtered = useMemo(() => {
    if (!filter) return dreams
    return dreams.filter((d) => d.status === filter)
  }, [dreams, filter])

  const grouped = useMemo(() => {
    const map = new Map<DreamCategory, typeof dreams>()
    for (const cat of DREAM_CATEGORIES) {
      map.set(cat.value, [])
    }
    for (const d of filtered) {
      const cat = d.category as DreamCategory
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

  // Goals linked to the detail dream
  const linkedGoals = useMemo(() => {
    if (!detail) return []
    return goals.filter((g) => g.dream_id === detail.id)
  }, [detail, goals])

  async function handleAddDream() {
    if (!newTitle.trim()) return
    const result = await addDream({
      title: newTitle.trim(),
      description: newDesc.trim() || null,
      category: autoCategory,
    })
    if (result) {
      setNewTitle('')
      setNewDesc('')
      setShowAdd(false)
      const catInfo = CATEGORY_MAP.get(autoCategory)
      toast(`${catInfo?.icon} ${catInfo?.label}に分類しました`)
    }
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

  return (
    <div className="page">
      <PageHeader
        title="100の夢リスト"
        description="いつか叶えたい夢を自由に書き出す場所。具体的な計画は Goals で。"
        actions={
          <button className="btn btn-p btn-sm" onClick={() => setShowAdd(true)}>
            + 新しい夢を追加
          </button>
        }
      />

      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 12, color: 'var(--text2)' }}>
        <span>達成: <strong>{stats.achieved}</strong></span>
        <span>進行中: <strong>{stats.inProgress}</strong></span>
        <span>全: <strong>{stats.total}</strong></span>
      </div>

      {/* Filters */}
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

      {/* Grouped by category */}
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
          {DREAM_CATEGORIES.map((cat) => {
            const items = grouped.get(cat.value) || []
            if (items.length === 0) return null
            return (
              <div key={cat.value}>
                <div className="section-title" style={{ marginBottom: 8 }}>
                  {cat.icon} {cat.label} ({items.length}件)
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
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="新しい夢を追加">
        <div style={{ marginBottom: 12 }}>
          <label className="form-label">タイトル</label>
          <input
            className="input"
            placeholder="あなたの夢は?"
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
        {newTitle.trim() && (
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>自動分類:</span>
            <span className="tag tag-co">
              {CATEGORY_MAP.get(autoCategory)?.icon} {CATEGORY_MAP.get(autoCategory)?.label}
            </span>
          </div>
        )}
        <button className="btn btn-p" style={{ width: '100%' }} onClick={handleAddDream} disabled={!newTitle.trim()}>
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
              <select
                className="input"
                value={detail.category}
                onChange={async (e) => {
                  const newCat = e.target.value as DreamCategory
                  await updateDream(detail.id, { category: newCat })
                  const catInfo = CATEGORY_MAP.get(newCat)
                  toast(`${catInfo?.icon} ${catInfo?.label}に変更しました`)
                }}
                style={{ width: 'auto', fontSize: 11, padding: '3px 8px' }}
              >
                {DREAM_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                ))}
              </select>
              <span className={`tag ${detail.status === 'achieved' ? 'tag-done' : detail.status === 'in_progress' ? 'tag-in_progress' : 'tag-open'}`}>
                {DREAM_STATUSES.find((s) => s.value === detail.status)?.label}
              </span>
            </div>
            {detail.description && (
              <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 12 }}>
                {detail.description}
              </p>
            )}

            {/* Linked Goals section */}
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
