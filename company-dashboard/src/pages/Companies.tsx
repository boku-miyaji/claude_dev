import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PageHeader, EmptyState, SkeletonGrid } from '@/components/ui'
import { toast } from '@/components/ui/Toast'

interface Company {
  id: string
  name: string
  description: string | null
  status: string
  category_id: string | null
  server_path: string | null
}

interface Category {
  id: string
  name: string
  description: string | null
  sort_order: number
}

export function Companies() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [catRes, cosRes] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('companies').select('*').order('created_at'),
    ])
    setCategories(catRes.data || [])
    setCompanies((cosRes.data as Company[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleStatus(co: Company) {
    const newStatus = co.status === 'active' ? 'archived' : 'active'
    await supabase.from('companies').update({ status: newStatus }).eq('id', co.id)
    setCompanies((prev) => prev.map((c) => c.id === co.id ? { ...c, status: newStatus } : c))
    toast(newStatus === 'archived' ? 'アーカイブしました' : '有効化しました')
  }

  if (loading) return <div className="page"><PageHeader title="Companies" /><SkeletonGrid cols={3} count={6} /></div>

  const grouped: Record<string, Company[]> = {}
  const uncategorized: Company[] = []
  companies.forEach((c) => {
    if (c.category_id) {
      if (!grouped[c.category_id]) grouped[c.category_id] = []
      grouped[c.category_id].push(c)
    } else {
      uncategorized.push(c)
    }
  })

  return (
    <div className="page">
      <PageHeader title="Companies" description="PJ会社の管理" />

      {companies.length === 0 ? (
        <EmptyState icon="◫" message="まだPJ会社がありません。最初の会社を作成しましょう。" />
      ) : (
        <>
          {categories.map((cat) => {
            const catCos = grouped[cat.id] || []
            if (catCos.length === 0) return null
            return (
              <div key={cat.id}>
                <div className="section-title" style={{ marginTop: 20 }}>
                  {cat.name}{cat.description ? ` — ${cat.description}` : ''}
                </div>
                <div className="g3" style={{ marginBottom: 16 }}>
                  {catCos.map((co) => <CompanyCard key={co.id} co={co} onToggle={toggleStatus} />)}
                </div>
              </div>
            )
          })}
          {uncategorized.length > 0 && (
            <>
              <div className="section-title" style={{ marginTop: 20 }}>その他</div>
              <div className="g3">
                {uncategorized.map((co) => <CompanyCard key={co.id} co={co} onToggle={toggleStatus} />)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function CompanyCard({ co, onToggle }: { co: Company; onToggle: (co: Company) => void }) {
  return (
    <div className="card co-card card-glow">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="co-id">{co.id}</div>
          <div className="co-name">{co.name}</div>
        </div>
        <span className={`dot dot-${co.status}`} />
      </div>
      <div className="co-desc">{co.description || ''}</div>
      {co.server_path && (
        <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', marginTop: 6 }}>{co.server_path}</div>
      )}
      <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
        <button className="btn btn-g btn-sm" onClick={() => onToggle(co)}>
          {co.status === 'active' ? 'アーカイブ' : '有効化'}
        </button>
      </div>
    </div>
  )
}
