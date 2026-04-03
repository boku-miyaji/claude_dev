import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, PageHeader, Modal, EmptyState } from '@/components/ui'
import { toast } from '@/components/ui/Toast'
import { DREAM_CATEGORIES, DREAM_STATUSES } from '@/types/dreams'
import type { Dream, DreamCategory, DreamStatus } from '@/types/dreams'

const CATEGORY_MAP = new Map(DREAM_CATEGORIES.map((c) => [c.value, c]))

export function Dreams() {
  const [dreams, setDreams] = useState<Dream[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<DreamStatus | ''>('')
  const [showAdd, setShowAdd] = useState(false)
  const [detail, setDetail] = useState<Dream | null>(null)

  // Add form state
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newCategory, setNewCategory] = useState<DreamCategory>('other')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('dreams')
      .select('*')
      .order('created_at', { ascending: false })
    setDreams((data as Dream[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    if (!filter) return dreams
    return dreams.filter((d) => d.status === filter)
  }, [dreams, filter])

  const grouped = useMemo(() => {
    const map = new Map<DreamCategory, Dream[]>()
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

  async function addDream() {
    if (!newTitle.trim()) return
    const { data, error } = await supabase
      .from('dreams')
      .insert({ title: newTitle.trim(), description: newDesc.trim() || null, category: newCategory })
      .select()
      .single()
    if (error) { toast(error.message); return }
    if (data) setDreams((prev) => [data as Dream, ...prev])
    setNewTitle('')
    setNewDesc('')
    setNewCategory('other')
    setShowAdd(false)
    toast('夢を追加しました')
  }

  async function updateStatus(dream: Dream, status: DreamStatus) {
    const updates: Partial<Dream> = {
      status,
      achieved_at: status === 'achieved' ? new Date().toISOString() : null,
    }
    const { error } = await supabase
      .from('dreams')
      .update(updates)
      .eq('id', dream.id)
    if (error) { toast(error.message); return }
    setDreams((prev) => prev.map((d) => d.id === dream.id ? { ...d, ...updates } : d))
    setDetail(null)
    const label = DREAM_STATUSES.find((s) => s.value === status)?.label || status
    toast(`「${dream.title}」を${label}に変更しました`)
  }

  async function deleteDream(dream: Dream) {
    const { error } = await supabase.from('dreams').delete().eq('id', dream.id)
    if (error) { toast(error.message); return }
    setDreams((prev) => prev.filter((d) => d.id !== dream.id))
    setDetail(null)
    toast(`「${dream.title}」を削除しました`)
  }

  if (loading) {
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
        description={`達成: ${stats.achieved} / 進行中: ${stats.inProgress} / 全: ${stats.total}`}
        actions={
          <button className="btn btn-p btn-sm" onClick={() => setShowAdd(true)}>
            + 新しい夢を追加
          </button>
        }
      />

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
                      onClick={() => setDetail(d)}
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
        <div style={{ marginBottom: 12 }}>
          <label className="form-label">カテゴリ</label>
          <select
            className="input"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as DreamCategory)}
          >
            {DREAM_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-p" style={{ width: '100%' }} onClick={addDream} disabled={!newTitle.trim()}>
          追加する
        </button>
      </Modal>

      {/* Detail modal */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.title || ''}
        footer={
          <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'space-between' }}>
            <button className="btn btn-d btn-sm" onClick={() => detail && deleteDream(detail)}>削除</button>
            <div style={{ display: 'flex', gap: 8 }}>
              {DREAM_STATUSES.filter((s) => s.value !== detail?.status).map((s) => (
                <button
                  key={s.value}
                  className={`btn btn-sm ${s.value === 'achieved' ? 'btn-p' : 'btn-g'}`}
                  onClick={() => detail && updateStatus(detail, s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        }
      >
        {detail && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <span className="tag tag-co">
                {CATEGORY_MAP.get(detail.category)?.icon} {CATEGORY_MAP.get(detail.category)?.label}
              </span>
              <span className={`tag ${detail.status === 'achieved' ? 'tag-done' : detail.status === 'in_progress' ? 'tag-in_progress' : 'tag-open'}`}>
                {DREAM_STATUSES.find((s) => s.value === detail.status)?.label}
              </span>
            </div>
            {detail.description && (
              <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 12 }}>
                {detail.description}
              </p>
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
