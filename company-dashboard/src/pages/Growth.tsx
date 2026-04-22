import { useEffect, useRef, useState } from 'react'
import { Card, PageHeader, EmptyState, KpiCard } from '@/components/ui'
import { supabase } from '@/lib/supabase'

interface GrowthEvent {
  id: number; title: string; event_date: string; event_type: string
  category: string; severity?: string; status?: string; phase?: string
  what_happened?: string; root_cause?: string; countermeasure?: string
  result?: string; related_commits?: string[]; related_migrations?: string[]
  tags?: string[]; source?: string
}

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  failure: { label: 'FAILURE', icon: '✕', color: 'var(--red)' },
  countermeasure: { label: 'COUNTERMEASURE', icon: '◆', color: 'var(--amber)' },
  decision: { label: 'DECISION', icon: '◉', color: 'var(--accent)' },
  milestone: { label: 'MILESTONE', icon: '★', color: 'var(--green)' },
}

const PROJECT_TAGS = [
  { key: 'all', label: 'すべて' },
  { key: 'claude-dev', label: 'claude-dev' },
  { key: 'focus-you', label: 'focus-you' },
  { key: 'polaris-circuit', label: 'polaris-circuit' },
  { key: 'rikyu', label: 'rikyu' },
  { key: 'agent-harness', label: 'agent-harness' },
  { key: 'unclassified', label: '未分類' },
]
const PROJECT_KEYS = new Set(['claude-dev','focus-you','polaris-circuit','rikyu','agent-harness'])

const CAT_ICONS: Record<string, string> = {
  security: '🛡', architecture: '🏗', devops: '⚙', automation: '🤖',
  tooling: '🔧', organization: '🏢', process: '📋',
}

const SEV_COLORS: Record<string, string> = {
  critical: 'var(--red)', high: 'var(--amber)', medium: 'var(--blue)', low: 'var(--text3)',
}

const FILTERS = [
  { key: 'all', label: 'All' }, { key: 'failure', label: 'Failures' },
  { key: 'countermeasure', label: 'Countermeasures' },
  { key: 'decision', label: 'Decisions' },
  { key: 'milestone', label: 'Milestones' },
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

interface TooltipState {
  x: number; y: number; date: string; prompts: number; evts: number; visible: boolean
}

function WorkIntensityChart() {
  const [promptCounts, setPromptCounts] = useState<Record<string, number> | null>(null)
  const [evtCounts, setEvtCounts] = useState<Record<string, number>>({})
  const [tooltip, setTooltip] = useState<TooltipState>({ x: 0, y: 0, date: '', prompts: 0, evts: 0, visible: false })
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const today = new Date()
    const since = new Date(today)
    since.setDate(today.getDate() - 29)
    const sinceStr = since.toISOString().slice(0, 10)

    Promise.all([
      supabase
        .from('prompt_log')
        .select('created_at')
        .gte('created_at', sinceStr),
      supabase
        .from('growth_events')
        .select('event_date')
        .gte('event_date', sinceStr),
    ]).then(([{ data: pData }, { data: eData }]) => {
      // Aggregate prompt_log by day
      const pc: Record<string, number> = {}
      for (const row of pData || []) {
        const day = (row.created_at as string).slice(0, 10)
        pc[day] = (pc[day] || 0) + 1
      }
      setPromptCounts(pc)

      // Aggregate growth_events by day
      const ec: Record<string, number> = {}
      for (const row of eData || []) {
        const day = (row.event_date as string).slice(0, 10)
        ec[day] = (ec[day] || 0) + 1
      }
      setEvtCounts(ec)
    })
  }, [])

  // Not yet loaded
  if (promptCounts === null) return null
  // No prompt data → hide section
  if (Object.keys(promptCounts).length === 0) return null

  // Build 30-day date list
  const days: string[] = []
  const today = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }

  const svgW = 700
  const svgH = 120
  const padL = 32
  const padR = 8
  const padT = 8
  const padB = 24
  const chartW = svgW - padL - padR
  const chartH = svgH - padT - padB
  const barSlot = chartW / days.length
  const barW = Math.max(2, barSlot - 2)
  const maxPrompts = Math.max(...days.map((d) => promptCounts[d] || 0), 1)

  const formatDate = (iso: string) => {
    const [, m, dd] = iso.split('-')
    return `${m}/${dd}`
  }

  return (
    <>
      <div className="section-title" style={{ marginBottom: 8 }}>Work Intensity</div>
      <Card style={{ padding: '14px 18px', marginBottom: 20, overflow: 'hidden' }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, display: 'flex', gap: 16 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--accent)', borderRadius: 2 }} />
            Prompts / day
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--green)', borderRadius: '50%' }} />
            Growth events
          </span>
        </div>
        <div style={{ position: 'relative' }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${svgW} ${svgH}`}
            style={{ width: '100%', height: svgH, display: 'block' }}
            onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
          >
            {/* Y-axis max label */}
            <text x={padL - 4} y={padT + 6} textAnchor="end" fontSize={9} fill="var(--text3)">{maxPrompts}</text>
            <text x={padL - 4} y={padT + chartH} textAnchor="end" fontSize={9} fill="var(--text3)">0</text>

            {/* Grid line top */}
            <line x1={padL} y1={padT} x2={padL + chartW} y2={padT} stroke="var(--border)" strokeWidth={0.5} />
            {/* Grid line bottom */}
            <line x1={padL} y1={padT + chartH} x2={padL + chartW} y2={padT + chartH} stroke="var(--border)" strokeWidth={0.5} />

            {days.map((day, i) => {
              const x = padL + i * barSlot + (barSlot - barW) / 2
              const pCount = promptCounts[day] || 0
              const eCount = evtCounts[day] || 0
              const barH = pCount > 0 ? Math.max(2, (pCount / maxPrompts) * chartH) : 0
              const barY = padT + chartH - barH

              return (
                <g key={day}>
                  {/* Prompt bar */}
                  {barH > 0 && (
                    <rect
                      x={x} y={barY} width={barW} height={barH}
                      fill="var(--accent)" fillOpacity={0.75} rx={1}
                    />
                  )}
                  {/* Growth event dot */}
                  {eCount > 0 && (
                    <circle
                      cx={x + barW / 2}
                      cy={barY > padT + 6 ? barY - 4 : padT + 4}
                      r={3}
                      fill="var(--green)"
                    />
                  )}
                  {/* X-axis label — show every 5th day */}
                  {i % 5 === 0 && (
                    <text
                      x={x + barW / 2} y={svgH - 4}
                      textAnchor="middle" fontSize={8} fill="var(--text3)"
                    >{formatDate(day)}</text>
                  )}
                  {/* Invisible hover target */}
                  <rect
                    x={padL + i * barSlot} y={padT} width={barSlot} height={chartH + padB}
                    fill="transparent"
                    onMouseEnter={() => {
                      const svg = svgRef.current
                      if (!svg) return
                      const rect = svg.getBoundingClientRect()
                      const scaleX = rect.width / svgW
                      setTooltip({
                        x: (padL + i * barSlot + barSlot / 2) * scaleX,
                        y: 0,
                        date: day,
                        prompts: pCount,
                        evts: eCount,
                        visible: true,
                      })
                    }}
                  />
                </g>
              )
            })}
          </svg>
          {/* Tooltip */}
          {tooltip.visible && (
            <div style={{
              position: 'absolute', top: 4, left: tooltip.x,
              transform: 'translateX(-50%)',
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '6px 10px', fontSize: 11,
              pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 10,
              boxShadow: '0 2px 8px rgba(0,0,0,.2)',
            }}>
              <div style={{ fontFamily: 'var(--mono)', color: 'var(--text3)', marginBottom: 3 }}>{tooltip.date}</div>
              <div style={{ color: 'var(--accent)' }}>{tooltip.prompts} prompts</div>
              {tooltip.evts > 0 && <div style={{ color: 'var(--green)' }}>{tooltip.evts} growth events</div>}
            </div>
          )}
        </div>
      </Card>
    </>
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

function matchProject(evt: GrowthEvent, key: string): boolean {
  if (key === 'all') return true
  const tags = evt.tags || []
  if (key === 'unclassified') return !tags.some(t => PROJECT_KEYS.has(t))
  return tags.includes(key)
}

export function Growth() {
  const [events, setEvents] = useState<GrowthEvent[]>([])
  const [filter, setFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [projectFilter, setProjectFilter] = useState<string>('all')
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
  const decisions = events.filter((e) => e.event_type === 'decision')
  const milestones = events.filter((e) => e.event_type === 'milestone')

  const filtered = events
    .filter(e => filter === 'all' || e.event_type === filter || e.category === filter)
    .filter(e => sourceFilter === 'all' || (e.source || 'manual') === sourceFilter)
    .filter(e => matchProject(e, projectFilter))

  // Source counts for filter buttons
  const sourceCounts: Record<string, number> = { all: events.length }
  events.forEach(e => {
    const s = e.source || 'manual'
    sourceCounts[s] = (sourceCounts[s] || 0) + 1
  })

  // Project counts
  const projectCounts: Record<string, number> = { all: events.length, unclassified: 0 }
  events.forEach(e => {
    const tags = e.tags || []
    let matched = false
    for (const t of tags) {
      if (PROJECT_KEYS.has(t)) {
        projectCounts[t] = (projectCounts[t] || 0) + 1
        matched = true
      }
    }
    if (!matched) projectCounts.unclassified++
  })

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

      <div className="g4" style={{ marginBottom: 8 }}>
        <KpiCard value={events.length} label="Total Events" />
        <KpiCard value={failures.length} label="Failures" status="bad" />
        <KpiCard value={countermeasures.length} label="Countermeasures" />
        <KpiCard value={milestones.length} label="Milestones" status="good" />
      </div>
      <div className="g4" style={{ marginBottom: 20 }}>
        <KpiCard value={decisions.length} label="Decisions" />
        <KpiCard value={projectCounts['claude-dev'] || 0} label="claude-dev" />
        <KpiCard value={projectCounts['focus-you'] || 0} label="focus-you" />
        <KpiCard value={projectCounts.unclassified || 0} label="未分類" />
      </div>

      <WorkIntensityChart />

      <CategoryProgress events={events} />

      <div className="growth-filters" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
        {FILTERS.map((f) => (
          <button key={f.key} className={`growth-filter-btn${filter === f.key ? ' active' : ''}`}
            onClick={() => setFilter(f.key)}>{f.label}</button>
        ))}
      </div>

      {/* Project filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8, fontSize: 11 }}>
        <span style={{ color: 'var(--text3)', alignSelf: 'center', marginRight: 4 }}>PJ:</span>
        {PROJECT_TAGS.map(p => {
          const count = projectCounts[p.key] || 0
          const active = projectFilter === p.key
          if (p.key !== 'all' && count === 0) return null
          return (
            <button key={p.key}
              onClick={() => setProjectFilter(p.key)}
              style={{
                padding: '3px 10px',
                borderRadius: 4,
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                background: active ? 'var(--accent)' : 'transparent',
                color: active ? '#fff' : 'var(--text3)',
                cursor: 'pointer',
                fontFamily: 'var(--font)',
                fontSize: 11,
              }}>
              {p.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Source filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16, fontSize: 11 }}>
        <span style={{ color: 'var(--text3)', alignSelf: 'center', marginRight: 4 }}>記録元:</span>
        {[
          { key: 'all', label: 'すべて' },
          { key: 'manual', label: '手動' },
          { key: 'daily-digest', label: '日次ダイジェスト' },
          { key: 'backfill', label: '過去backfill' },
          { key: 'detector', label: '検知' },
        ].map(f => {
          const count = sourceCounts[f.key] || 0
          const active = sourceFilter === f.key
          if (f.key !== 'all' && count === 0) return null
          return (
            <button key={f.key}
              onClick={() => setSourceFilter(f.key)}
              style={{
                padding: '3px 10px',
                borderRadius: 4,
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                background: active ? 'var(--accent)' : 'transparent',
                color: active ? '#fff' : 'var(--text3)',
                cursor: 'pointer',
                fontFamily: 'var(--font)',
                fontSize: 11,
              }}>
              {f.label} ({count})
            </button>
          )
        })}
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
