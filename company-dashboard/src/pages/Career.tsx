import { useEffect, useState } from 'react'
import { PageHeader, EmptyState, toast } from '@/components/ui'
import { supabase } from '@/lib/supabase'

// ============================================================
// Types
// ============================================================

interface CareerItem {
  id: string
  title: string
  organization?: string
  role?: string
  start_date: string
  end_date?: string
  description?: string
  tags?: string[]
}

interface Invoice {
  client_name: string
  invoice_date: string
}

interface CareerFormState {
  title: string
  organization: string
  role: string
  start_date: string
  end_date: string
  description: string
  tags: string
}

// ============================================================
// Career Form Modal
// ============================================================

function CareerModal({
  item,
  onClose,
  onSaved,
}: {
  item: Partial<CareerItem> | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!item?.id
  const [form, setForm] = useState<CareerFormState>({
    title: item?.title ?? '',
    organization: item?.organization ?? '',
    role: item?.role ?? '',
    start_date: item?.start_date ?? '',
    end_date: item?.end_date ?? '',
    description: item?.description ?? '',
    tags: (item?.tags ?? []).join(', '),
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!form.title.trim()) { setError('タイトルは必須です'); return }
    if (!form.start_date) { setError('開始日は必須です'); return }
    setSaving(true)
    const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean)
    const data = {
      title: form.title.trim(),
      organization: form.organization.trim() || null,
      role: form.role.trim() || null,
      start_date: form.start_date,
      end_date: form.end_date || null,
      description: form.description.trim() || null,
      tags: tags.length > 0 ? tags : null,
    }
    const { error: dbError } = isEdit
      ? await supabase.from('career_history').update(data).eq('id', item!.id!)
      : await supabase.from('career_history').insert(data)
    setSaving(false)
    if (dbError) { setError(`保存に失敗しました: ${dbError.message}`); toast('保存に失敗しました'); return }
    toast(isEdit ? '更新しました' : '追加しました')
    onClose()
    onSaved()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.3)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 24, maxWidth: 500, width: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>{isEdit ? '経歴を編集' : '経歴を追加'}</div>

        {(['title', 'organization', 'role'] as const).map(key => (
          <div key={key} style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>
              {key === 'title' ? 'タイトル（例: AI開発エンジニア、東京大学 工学部）'
                : key === 'organization' ? '組織名（例: 株式会社ACES）'
                : '役職・立場（例: テックリード、業務委託）'}
            </label>
            <input
              className="input"
              value={form[key]}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              placeholder={key === 'title' ? '何をしていたか' : key === 'organization' ? '所属先' : '任意'}
            />
          </div>
        ))}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>開始日</label>
            <input type="date" className="input" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>終了日（空欄 = 現在）</label>
            <input type="date" className="input" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>詳細（やったこと・経験・成果）</label>
          <textarea className="input" style={{ minHeight: 100, resize: 'vertical' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="自由に記述" />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>タグ（カンマ区切り: AI, Python, マネジメント）</label>
          <input className="input" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="AI, LLM, Python" />
        </div>

        {error && <div style={{ fontSize: 12, color: '#ef4444', minHeight: 16, marginBottom: 8 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>キャンセル</button>
          <button className="btn btn-p" onClick={handleSave} disabled={saving}>{isEdit ? '更新' : '追加'}</button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Main Component
// ============================================================

export function Career() {
  const [items, setItems] = useState<CareerItem[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [formItem, setFormItem] = useState<Partial<CareerItem> | null | undefined>(undefined)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = async () => {
    const [histRes, invRes] = await Promise.all([
      supabase.from('career_history').select('*').order('start_date', { ascending: false }),
      supabase.from('invoices').select('client_name, invoice_date').order('invoice_date'),
    ])
    setItems(histRes.data || [])
    setInvoices(invRes.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (item: CareerItem) => {
    if (!confirm(`"${item.title}" を削除しますか？`)) return
    setDeletingId(item.id)
    const { error: dbError } = await supabase.from('career_history').delete().eq('id', item.id)
    setDeletingId(null)
    if (dbError) { toast('削除に失敗しました'); return }
    toast('削除しました')
    load()
  }

  if (loading) {
    return (
      <div className="page">
        <PageHeader title="Career" description="経歴の時系列と概要" />
        <div className="skeleton-card" style={{ height: 200 }} />
      </div>
    )
  }

  // Summary stats
  let totalYears = 0
  const orgSet: Record<string, boolean> = {}
  const allTags: Record<string, number> = {}
  items.forEach(item => {
    const end = item.end_date ? new Date(item.end_date) : new Date()
    const start = new Date(item.start_date)
    totalYears += (end.getTime() - start.getTime()) / (365.25 * 86400000)
    if (item.organization) orgSet[item.organization] = true
    ;(item.tags || []).forEach(t => { allTags[t] = (allTags[t] || 0) + 1 })
  })
  const topTags = Object.keys(allTags).sort((a, b) => allTags[b] - allTags[a]).slice(0, 10)
  const current = items.filter(i => !i.end_date)

  // Suggestions from invoices
  const existingOrgs: Record<string, boolean> = {}
  items.forEach(i => { if (i.organization) existingOrgs[i.organization] = true })
  const clientPeriods: Record<string, { first: string; last: string }> = {}
  invoices.forEach(inv => {
    const name = inv.client_name
    if (!clientPeriods[name]) clientPeriods[name] = { first: inv.invoice_date, last: inv.invoice_date }
    if (inv.invoice_date < clientPeriods[name].first) clientPeriods[name].first = inv.invoice_date
    if (inv.invoice_date > clientPeriods[name].last) clientPeriods[name].last = inv.invoice_date
  })
  const suggestions = Object.keys(clientPeriods).filter(name => !existingOrgs[name])

  return (
    <div className="page">
      <PageHeader title="Career" description="経歴の時系列と概要" />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-p" onClick={() => setFormItem(null)}>+ 経歴を追加</button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon="☆" message="経歴がまだ登録されていません" />
      ) : (
        <>
          {/* Summary card */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 24 }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>Summary</div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 16 }}>
              {[
                { v: `${Math.round(totalYears * 10) / 10}年`, l: '経験年数' },
                { v: Object.keys(orgSet).length, l: '所属組織' },
                { v: items.length, l: '経歴数' },
                { v: current.length, l: '現在進行中', color: 'var(--accent)' },
              ].map(({ v, l, color }) => (
                <div key={l}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: color || 'inherit' }}>{v}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{l}</div>
                </div>
              ))}
            </div>
            {topTags.length > 0 && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {topTags.map(t => (
                  <span key={t} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'var(--surface2)', color: 'var(--text2)' }}>{t}</span>
                ))}
              </div>
            )}
          </div>

          {/* Suggestions from invoices */}
          {suggestions.length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>請求書データから検出（未登録）</div>
              {suggestions.map(name => {
                const p = clientPeriods[name]
                return (
                  <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginLeft: 8 }}>{p.first.substring(0, 7)} — {p.last.substring(0, 7)}</span>
                    </div>
                    <button
                      className="btn btn-p btn-sm"
                      style={{ fontSize: 11 }}
                      onClick={() => setFormItem({ title: '業務委託', organization: name, role: '業務委託', start_date: p.first, tags: [] })}
                    >+ 登録</button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Info */}
          <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 11, color: 'var(--text3)', lineHeight: 1.7 }}>
            <span style={{ color: 'var(--text2)', fontWeight: 600 }}>自動</span>: Summary（経験年数・組織数・タグ集計）、請求書からの未登録クライアント検出　|
            <span style={{ color: 'var(--text2)', fontWeight: 600 }}>手動</span>: 経歴の追加・編集・削除、詳細や役職の記入
          </div>

          {/* Timeline */}
          <div style={{ position: 'relative', paddingLeft: 20 }}>
            <div style={{ position: 'absolute', left: 7, top: 8, bottom: 8, width: 2, background: 'var(--border)' }} />
            {items.map(item => {
              const isCurrent = !item.end_date
              const startY = item.start_date.substring(0, 7).replace('-', '/')
              const endY = isCurrent ? '現在' : (item.end_date || '').substring(0, 7).replace('-', '/')
              return (
                <div key={item.id} style={{ padding: '14px 0', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: -17, top: 18, width: 10, height: 10, borderRadius: '50%', background: isCurrent ? 'var(--accent)' : 'var(--border2)', border: '2px solid var(--surface)' }} />
                  <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)', marginBottom: 4 }}>{startY} — {endY}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{item.title}</span>
                    {item.organization && <span style={{ fontSize: 12, color: 'var(--text3)' }}>{item.organization}</span>}
                    {item.role && <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500 }}>{item.role}</span>}
                    {isCurrent && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: 'var(--accent)', color: '#fff', fontWeight: 600 }}>NOW</span>}
                  </div>
                  {item.description && <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{item.description}</div>}
                  {item.tags && item.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                      {item.tags.map(t => <span key={t} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'var(--surface2)', color: 'var(--text3)' }}>{t}</span>)}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button className="btn btn-g btn-sm" style={{ fontSize: 11 }} onClick={() => setFormItem(item)}>編集</button>
                    <button
                      className="btn btn-sm"
                      style={{ fontSize: 11, color: 'var(--red)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                      disabled={deletingId === item.id}
                      onClick={() => handleDelete(item)}
                    >削除</button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {formItem !== undefined && (
        <CareerModal
          item={formItem}
          onClose={() => setFormItem(undefined)}
          onSaved={() => { setFormItem(undefined); load() }}
        />
      )}
    </div>
  )
}
