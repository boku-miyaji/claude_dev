import { useEffect, useState } from 'react'
import { Card, PageHeader, EmptyState, KpiCard } from '@/components/ui'
import { supabase } from '@/lib/supabase'

interface GrowthEvent {
  id: number; title: string; event_date: string; event_type: string
  category: string; severity?: string; status?: string; phase?: string
  what_happened?: string; root_cause?: string; countermeasure?: string
  result?: string; related_commits?: string[]; related_migrations?: string[]
  tags?: string[]
}

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  failure: { label: 'FAILURE', icon: '✕', color: 'var(--red)' },
  countermeasure: { label: 'COUNTERMEASURE', icon: '◆', color: 'var(--amber)' },
  milestone: { label: 'MILESTONE', icon: '★', color: 'var(--green)' },
}

const CAT_ICONS: Record<string, string> = {
  security: '🛡', architecture: '🏗', devops: '⚙', automation: '🤖',
  tooling: '🔧', organization: '🏢', process: '📋',
}

const SEV_COLORS: Record<string, string> = {
  critical: 'var(--red)', high: 'var(--amber)', medium: 'var(--blue)', low: 'var(--text3)',
}

const FILTERS = [
  { key: 'all', label: 'All' }, { key: 'failure', label: 'Failures' },
  { key: 'countermeasure', label: 'Countermeasures' }, { key: 'milestone', label: 'Milestones' },
  { key: 'security', label: 'Security' }, { key: 'architecture', label: 'Architecture' },
  { key: 'devops', label: 'DevOps' }, { key: 'automation', label: 'Automation' },
  { key: 'tooling', label: 'Tooling' }, { key: 'organization', label: 'Organization' },
]

function TagBadge({ text, bg, color, border }: { text: string; bg: string; color: string; border?: string }) {
  return <span className="tag" style={{ background: bg, color, border: border || `1px solid ${color}33`, fontSize: 11 }}>{text}</span>
}

function EventCard({ evt }: { evt: GrowthEvent }) {
  const [expanded, setExpanded] = useState(false)
  const tc = TYPE_CONFIG[evt.event_type] || { label: evt.event_type, icon: '·', color: 'var(--text3)' }

  return (
    <div className="growth-event" style={{ display: 'flex', gap: 12, marginBottom: 4 }}>
      <div className={`growth-dot ${evt.event_type}`} style={{
        width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, color: tc.color, background: `${tc.color}15`, border: `2px solid ${tc.color}`,
        flexShrink: 0, marginTop: 4,
      }}>{tc.icon}</div>

      <div className="card" style={{ flex: 1, padding: '14px 18px', cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{evt.title}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{evt.event_date}</div>
        </div>

        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
          <TagBadge text={tc.label} bg={`${tc.color}11`} color={tc.color} />
          <span className="tag tag-co">{evt.category}</span>
          {(evt.severity === 'critical' || evt.severity === 'high') && (
            <TagBadge text={evt.severity} bg={`${SEV_COLORS[evt.severity]}11`} color={SEV_COLORS[evt.severity]} />
          )}
          {evt.status === 'resolved' && <TagBadge text="resolved" bg="var(--green-bg)" color="var(--green)" border="1px solid var(--green-border)" />}
        </div>

        {evt.what_happened && <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{evt.what_happened}</div>}

        {expanded && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {evt.root_cause && <Detail label="Root Cause" text={evt.root_cause} />}
            {evt.countermeasure && <Detail label="Countermeasure" text={evt.countermeasure} />}
            {evt.result && <Detail label="Result / Learning" text={evt.result} />}
            {(evt.related_commits ?? []).length > 0 && (
              <Detail label="Related Commits">
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {(evt.related_commits ?? []).map((c) => <span key={c} className="tag" style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>{c}</span>)}
                </div>
              </Detail>
            )}
            {(evt.tags ?? []).length > 0 && (
              <Detail label="Tags">
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {(evt.tags ?? []).map((t) => <span key={t} className="tag" style={{ fontSize: 10, color: 'var(--text3)' }}>{t}</span>)}
                </div>
              </Detail>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Detail({ label, text, children }: { label: string; text?: string; children?: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>{label}</div>
      {text ? <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>{text}</div> : children}
    </div>
  )
}

function CategoryProgress({ events }: { events: GrowthEvent[] }) {
  const cats = ['security', 'architecture', 'devops', 'automation', 'tooling', 'organization', 'process']
  const catData = cats.map((cat) => {
    const items = events.filter((e) => e.category === cat)
    if (items.length === 0) return null
    const resolved = items.filter((e) => e.status === 'resolved').length
    const pct = Math.round((resolved / items.length) * 100)
    return { cat, total: items.length, resolved, pct }
  }).filter(Boolean)

  if (catData.length === 0) return null

  return (
    <>
      <div className="section-title">Category Progress</div>
      <div className="g2" style={{ marginBottom: 20 }}>
        {catData.map((d) => (
          <Card key={d!.cat} style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{CAT_ICONS[d!.cat] || ''} {d!.cat}</span>
              <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text2)' }}>{d!.resolved}/{d!.total}</span>
            </div>
            <div className="growth-cat-bar">
              <div className="growth-cat-fill" style={{
                width: `${d!.pct}%`,
                background: d!.pct === 100 ? 'var(--green)' : d!.pct >= 50 ? 'var(--amber)' : 'var(--red)',
              }} />
            </div>
          </Card>
        ))}
      </div>
    </>
  )
}

export function Growth() {
  const [events, setEvents] = useState<GrowthEvent[]>([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('growth_events').select('*')
      .order('event_date', { ascending: true })
      .order('created_at', { ascending: true })
      .then(({ data }) => { setEvents(data || []); setLoading(false) })
  }, [])

  if (loading) return <div className="page"><PageHeader title="Growth Chronicle" description="失敗と進化の記録" /><div className="skeleton-card" style={{ height: 200 }} /></div>
  if (events.length === 0) return <div className="page"><PageHeader title="Growth Chronicle" description="失敗と進化の記録" /><EmptyState icon="↗" message="まだ成長記録がありません。" /></div>

  const failures = events.filter((e) => e.event_type === 'failure')
  const countermeasures = events.filter((e) => e.event_type === 'countermeasure')
  const milestones = events.filter((e) => e.event_type === 'milestone')

  const filtered = filter === 'all' ? events : events.filter((e) => e.event_type === filter || e.category === filter)

  // Group by phase
  const phases: { name: string; items: GrowthEvent[] }[] = []
  const phaseMap: Record<string, GrowthEvent[]> = {}
  for (const e of filtered) {
    const p = e.phase || 'Other'
    if (!phaseMap[p]) { phaseMap[p] = []; phases.push({ name: p, items: phaseMap[p] }) }
    phaseMap[p].push(e)
  }

  return (
    <div className="page">
      <PageHeader title="Growth Chronicle" description="失敗と進化の記録 — どう壊れ、どう直し、どう成長したか" />

      <div className="g4" style={{ marginBottom: 20 }}>
        <KpiCard value={events.length} label="Total Events" />
        <KpiCard value={failures.length} label="Failures" status="bad" />
        <KpiCard value={countermeasures.length} label="Countermeasures" />
        <KpiCard value={milestones.length} label="Milestones" status="good" />
      </div>

      <CategoryProgress events={events} />

      <div className="growth-filters" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16 }}>
        {FILTERS.map((f) => (
          <button key={f.key} className={`growth-filter-btn${filter === f.key ? ' active' : ''}`}
            onClick={() => setFilter(f.key)}>{f.label}</button>
        ))}
      </div>

      {phases.map(({ name, items }) => (
        <div key={name} className="growth-phase" style={{ marginBottom: 24 }}>
          <div className="growth-phase-label" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 12 }}>{name}</div>
          {items.map((evt) => <EventCard key={evt.id} evt={evt} />)}
        </div>
      ))}
    </div>
  )
}
