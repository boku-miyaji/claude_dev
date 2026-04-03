import { PageHeader, KpiCard, EmptyState, SkeletonRows } from '@/components/ui'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'

interface KnowledgeItem {
  id: string
  rule: string
  reason: string | null
  category: string
  scope: string
  confidence: number
  status: string
  company_id: string | null
  promoted_to: string | null
  companies: { name: string } | null
}

const CAT_LABELS: Record<string, string> = {
  coding: 'Coding', documentation: 'Documentation', communication: 'Communication',
  design: 'Design', process: 'Process', quality: 'Quality',
  tools: 'Tools', domain: 'Domain', other: 'Other',
}

function ConfidenceDots({ level }: { level: number }) {
  const filled = Math.min(level, 5)
  const dots = '●'.repeat(filled) + '○'.repeat(5 - filled)
  return <div style={{ fontSize: 11, color: 'var(--accent2)', letterSpacing: 2 }}>{dots}</div>
}

export function Knowledge() {
  const { data: items, loading } = useSupabaseQuery<KnowledgeItem>({
    table: 'knowledge_base',
    select: '*,companies(name)',
    order: { column: 'confidence', ascending: false },
  })

  if (loading) {
    return <div className="page"><PageHeader title="Knowledge Base" /><SkeletonRows count={5} /></div>
  }

  const all = items || []
  const active = all.filter((i) => i.status === 'active')
  const promoted = all.filter((i) => i.status === 'promoted')

  // Group active by category
  const grouped: Record<string, KnowledgeItem[]> = {}
  active.forEach((i) => {
    if (!grouped[i.category]) grouped[i.category] = []
    grouped[i.category].push(i)
  })

  return (
    <div className="page">
      <PageHeader title="Knowledge Base" description="LLMデフォルトとの差分ルール — 毎回指示しなくても適用される知識" />

      <div className="g4" style={{ marginBottom: 24 }}>
        <KpiCard value={active.length} label="Active Rules" />
        <KpiCard value={active.filter((i) => i.confidence >= 3).length} label="High Confidence" status="good" />
        <KpiCard value={active.filter((i) => i.scope === 'global').length} label="Global" />
        <KpiCard value={promoted.length} label="Promoted to CLAUDE.md" />
      </div>

      {all.length === 0 && (
        <EmptyState
          message="ナレッジなし"
          icon="📚"
        />
      )}

      {Object.keys(CAT_LABELS).map((cat) => {
        const catItems = grouped[cat]
        if (!catItems?.length) return null
        return (
          <div key={cat}>
            <div className="section-title">{CAT_LABELS[cat]} ({catItems.length})</div>
            <div className="card" style={{ marginBottom: 20 }}>
              {catItems.map((item) => {
                const scopeLabel = item.scope === 'global' ? '全社' : (item.companies?.name || item.company_id || '')
                return (
                  <div key={item.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{item.rule}</div>
                        {item.reason && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{item.reason}</div>}
                      </div>
                      <div style={{ flexShrink: 0, textAlign: 'right' }}>
                        <ConfidenceDots level={item.confidence} />
                        <span className="tag tag-co" style={{ marginTop: 4 }}>{scopeLabel}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {promoted.length > 0 && (
        <>
          <div className="gradient-line" />
          <div className="section-title">Promoted to CLAUDE.md ({promoted.length})</div>
          <div className="card">
            {promoted.map((item) => (
              <div key={item.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: 'var(--green)' }}>✓</span>
                <span style={{ flex: 1, color: 'var(--text2)' }}>{item.rule}</span>
                <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{item.promoted_to || 'CLAUDE.md'}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
