import { useEffect, useState } from 'react'
import { PageHeader, EmptyState } from '@/components/ui'
import { supabase } from '@/lib/supabase'

// ============================================================
// Types
// ============================================================

interface CostEntry {
  source: string
  model: string
  tokens_input: number
  tokens_output: number
  cost_usd: number
  created_at: string
  prompt_summary?: string
}

interface ModelStats { cost: number; tokIn: number; tokOut: number; count: number }
interface DayStats { cost: number; tokIn: number; tokOut: number; count: number }
interface SourceStats { cost: number; tokIn: number; tokOut: number; count: number }

interface ExecMetric {
  source: string
  model?: string
  time_to_first_token_ms?: number
  total_time_ms?: number
  tools_used?: { name: string; duration_ms?: number }[]
  created_at: string
}

interface PromptLogEntry {
  tools_used?: Record<string, number>
  tool_count?: number
  created_at: string
}

const JPY = 150
const fmtY = (usd: number) => '¥' + Math.round(usd * JPY).toLocaleString()

const SOURCE_LABELS: Record<string, string> = {
  ai_chat: 'AIチャット', self_analysis: '自己分析', emotion_analysis: '感情分析',
  ai_partner: 'AIパートナー', dream_classify: '夢/目標分類', dream_detection: '夢達成検出',
  weekly_narrative: '週次レポート', news_collect: 'ニュース収集', arc_reader: 'Arc Reader',
  theme_finder: 'Theme Finder', moment_detector: '転機検出', emotion_insights: '感情示唆',
  search_rerank: '検索リランク', narrator_update: 'Narrator更新', news_learn: 'ニュース学習', other: 'その他',
}

const SRC_COLORS: Record<string, string> = {
  ai_chat: '#5046e5', self_analysis: '#0d9f6e', emotion_analysis: '#2563eb', ai_partner: '#d97706',
  dream_classify: '#8b5cf6', dream_detection: '#06b6d4', weekly_narrative: '#ec4899', news_collect: '#f59e0b',
  arc_reader: '#7c3aed', theme_finder: '#059669', moment_detector: '#dc2626', emotion_insights: '#4f46e5',
  search_rerank: '#0891b2', narrator_update: '#7c3aed', news_learn: '#ca8a04', other: '#6b7280',
}

// ============================================================
// Main Component
// ============================================================

export function ApiCosts() {
  const [periodDays, setPeriodDays] = useState(30)
  const [msgs, setMsgs] = useState<CostEntry[]>([])
  const [metrics, setMetrics] = useState<ExecMetric[]>([])
  const [promptLogs, setPromptLogs] = useState<PromptLogEntry[]>([])
  const [loading, setLoading] = useState(true)

  const load = async (days: number) => {
    setLoading(true)
    const since = new Date(Date.now() - days * 86400000).toISOString()
    const [msgRes, logRes, metricsRes, plRes] = await Promise.all([
      supabase.from('messages').select('model,tokens_input,tokens_output,cost_usd,created_at').eq('role', 'assistant').gte('created_at', since).not('cost_usd', 'is', null).order('created_at', { ascending: false }),
      supabase.from('api_cost_log').select('source,model,tokens_input,tokens_output,cost_usd,prompt_summary,created_at').gte('created_at', since).order('created_at', { ascending: false }),
      supabase.from('execution_metrics').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(500),
      supabase.from('prompt_log').select('tools_used,tool_count,created_at').gte('created_at', since).not('tools_used', 'is', null).order('created_at', { ascending: false }).limit(200),
    ])
    const combined: CostEntry[] = []
    ;(msgRes.data || []).forEach((m: { model: string; tokens_input: number; tokens_output: number; cost_usd: number; created_at: string }) => combined.push({ source: 'ai_chat', model: m.model, tokens_input: m.tokens_input, tokens_output: m.tokens_output, cost_usd: m.cost_usd, created_at: m.created_at }))
    ;(logRes.data || []).forEach((m: CostEntry) => combined.push({ source: m.source, model: m.model, tokens_input: m.tokens_input, tokens_output: m.tokens_output, cost_usd: m.cost_usd, created_at: m.created_at, prompt_summary: m.prompt_summary }))
    combined.sort((a, b) => b.created_at.localeCompare(a.created_at))
    setMsgs(combined)
    setMetrics(metricsRes.data || [])
    setPromptLogs(plRes.data || [])
    setLoading(false)
  }

  useEffect(() => { load(periodDays) }, [periodDays])

  if (loading) {
    return (
      <div className="page">
        <PageHeader title="APIコスト" description="AI Chat のAPI利用コストをモデル別・日別に集計（1$ = 150円換算）" />
        <div className="skeleton-card" style={{ height: 200 }} />
      </div>
    )
  }

  if (msgs.length === 0) {
    return (
      <div className="page">
        <PageHeader title="APIコスト" description="AI Chat のAPI利用コストをモデル別・日別に集計（1$ = 150円換算）" />
        <select className="input" style={{ fontSize: 12, width: 'auto', marginBottom: 16 }} value={periodDays} onChange={e => setPeriodDays(parseInt(e.target.value))}>
          <option value={7}>過去7日</option>
          <option value={30}>過去30日</option>
          <option value={90}>過去90日</option>
          <option value={365}>過去1年</option>
        </select>
        <EmptyState icon="$" message="この期間のAPI利用データはありません" />
      </div>
    )
  }

  // Aggregate
  let totalCost = 0, totalIn = 0, totalOut = 0, totalRequests = 0
  const byModel: Record<string, ModelStats> = {}
  const byDay: Record<string, DayStats> = {}
  const bySource: Record<string, SourceStats> = {}

  msgs.forEach(m => {
    const cost = parseFloat(String(m.cost_usd)) || 0
    const tokIn = m.tokens_input || 0
    const tokOut = m.tokens_output || 0
    const model = m.model || 'unknown'
    const day = m.created_at.substring(0, 10)
    const source = m.source || 'other'

    totalCost += cost; totalIn += tokIn; totalOut += tokOut; totalRequests++

    if (!byModel[model]) byModel[model] = { cost: 0, tokIn: 0, tokOut: 0, count: 0 }
    byModel[model].cost += cost; byModel[model].tokIn += tokIn; byModel[model].tokOut += tokOut; byModel[model].count++

    if (!byDay[day]) byDay[day] = { cost: 0, tokIn: 0, tokOut: 0, count: 0 }
    byDay[day].cost += cost; byDay[day].count++

    if (!bySource[source]) bySource[source] = { cost: 0, tokIn: 0, tokOut: 0, count: 0 }
    bySource[source].cost += cost; bySource[source].count++; bySource[source].tokIn += tokIn; bySource[source].tokOut += tokOut
  })

  const avgPerDay = totalCost / Math.max(1, Object.keys(byDay).length)
  const projectedMonthly = avgPerDay * 30
  const dayKeys = Object.keys(byDay).sort()
  const maxDayCost = Math.max(...dayKeys.map(k => byDay[k].cost)) || 1

  // Execution metrics
  const chatMetrics = metrics.filter(m => m.source === 'ai_chat' && m.time_to_first_token_ms)
  const ttftByModel: Record<string, number[]> = {}
  chatMetrics.forEach(m => {
    const mod = m.model || 'unknown'
    if (!ttftByModel[mod]) ttftByModel[mod] = []
    ttftByModel[mod].push(m.time_to_first_token_ms!)
  })

  const toolMetrics = metrics.filter(m => m.tools_used && m.tools_used.length)
  const toolStats: Record<string, { count: number; totalMs: number; durations: number[] }> = {}
  toolMetrics.forEach(m => {
    ;(m.tools_used || []).forEach(t => {
      if (!toolStats[t.name]) toolStats[t.name] = { count: 0, totalMs: 0, durations: [] }
      toolStats[t.name].count++
      if (t.duration_ms) { toolStats[t.name].totalMs += t.duration_ms; toolStats[t.name].durations.push(t.duration_ms) }
    })
  })

  const withTime = chatMetrics.filter(m => m.total_time_ms)
  const buckets: Record<string, number> = { '<1s': 0, '1-3s': 0, '3-5s': 0, '5-10s': 0, '10s+': 0 }
  withTime.forEach(m => {
    const s = m.total_time_ms! / 1000
    if (s < 1) buckets['<1s']++
    else if (s < 3) buckets['1-3s']++
    else if (s < 5) buckets['3-5s']++
    else if (s < 10) buckets['5-10s']++
    else buckets['10s+']++
  })
  const maxBucket = Math.max(...Object.values(buckets)) || 1

  // Claude Code tool stats
  const ccToolStats: Record<string, number> = {}
  let totalTools = 0
  promptLogs.forEach(p => {
    const tu = p.tools_used || {}
    Object.keys(tu).forEach(name => {
      if (!ccToolStats[name]) ccToolStats[name] = 0
      ccToolStats[name] += tu[name]; totalTools += tu[name]
    })
  })
  const maxToolCount = Math.max(...Object.values(ccToolStats)) || 1
  const totalCalls2 = Object.values(toolStats).reduce((s, v) => s + v.count, 0)

  return (
    <div className="page">
      <PageHeader title="APIコスト" description="AI Chat のAPI利用コストをモデル別・日別に集計（1$ = 150円換算）" />

      <select className="input" style={{ fontSize: 12, width: 'auto', marginBottom: 16 }} value={periodDays} onChange={e => setPeriodDays(parseInt(e.target.value))}>
        <option value={7}>過去7日</option>
        <option value={30}>過去30日</option>
        <option value={90}>過去90日</option>
        <option value={365}>過去1年</option>
      </select>

      {/* KPI */}
      <div className="g4" style={{ marginBottom: 24 }}>
        {[
          { label: '合計コスト', value: fmtY(totalCost), sub: `${periodDays}日間 ($${totalCost.toFixed(2)})` },
          { label: '月額見込み', value: fmtY(projectedMonthly), sub: `日平均 ${fmtY(avgPerDay)}` },
          { label: 'リクエスト数', value: totalRequests.toLocaleString(), sub: `日平均 ${(totalRequests / Math.max(1, Object.keys(byDay).length)).toFixed(1)}回` },
          { label: 'トークン合計', value: `${((totalIn + totalOut) / 1000).toFixed(1)}K`, sub: `In:${(totalIn / 1000).toFixed(1)}K Out:${(totalOut / 1000).toFixed(1)}K` },
        ].map(({ label, value, sub }) => (
          <div key={label} className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>{value}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Model breakdown */}
      <div className="section-title">モデル別内訳</div>
      <div className="card" style={{ marginBottom: 24, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              {['モデル', '回数', '入力トークン', '出力トークン', 'コスト', '平均/回', '割合'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.keys(byModel).sort((a, b) => byModel[b].cost - byModel[a].cost).map(model => {
              const d = byModel[model]
              const share = totalCost > 0 ? (d.cost / totalCost * 100) : 0
              return (
                <tr key={model} style={{ borderBottom: '1px solid var(--border)' }}>
                  {[model, d.count.toLocaleString(), d.tokIn.toLocaleString(), d.tokOut.toLocaleString(), fmtY(d.cost), fmtY(d.cost / Math.max(1, d.count)), `${share.toFixed(1)}%`].map((val, i) => (
                    <td key={i} style={{ padding: '8px 12px', whiteSpace: 'nowrap', ...(i >= 4 ? { fontFamily: 'var(--mono)' } : {}) }}>{val}</td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Source breakdown */}
      {Object.keys(bySource).length > 0 && (
        <>
          <div className="section-title">カテゴリ別内訳</div>
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', height: 28, borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
              {Object.keys(bySource).sort((a, b) => bySource[b].cost - bySource[a].cost).map(src => {
                const pct = totalCost > 0 ? Math.round(bySource[src].cost / totalCost * 100) : 0
                if (pct < 1) return null
                return <div key={src} title={`${SOURCE_LABELS[src] || src} ${fmtY(bySource[src].cost)} (${pct}%)`} style={{ width: `${pct}%`, background: SRC_COLORS[src] || '#6b7280' }} />
              })}
            </div>
            {Object.keys(bySource).sort((a, b) => bySource[b].cost - bySource[a].cost).map(src => {
              const d = bySource[src]
              const pct = totalCost > 0 ? (d.cost / totalCost * 100) : 0
              const barW = totalCost > 0 ? Math.round(d.cost / totalCost * 100) : 0
              return (
                <div key={src} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: SRC_COLORS[src] || '#6b7280', flexShrink: 0 }} />
                  <span style={{ width: 120, fontWeight: 500 }}>{SOURCE_LABELS[src] || src}</span>
                  <span style={{ width: 50, color: 'var(--text3)', fontSize: 11 }}>{d.count}回</span>
                  <div style={{ flex: 1, height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${barW}%`, background: SRC_COLORS[src] || '#6b7280', borderRadius: 3 }} />
                  </div>
                  <span style={{ width: 70, textAlign: 'right', fontWeight: 600, fontFamily: 'var(--mono)' }}>{fmtY(d.cost)}</span>
                  <span style={{ width: 45, textAlign: 'right', color: 'var(--text3)', fontSize: 11 }}>{pct.toFixed(1)}%</span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Daily chart */}
      <div className="section-title">日別コスト</div>
      <div className="card" style={{ marginBottom: 24, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120, overflowX: 'auto' }}>
          {dayKeys.map((day, idx) => {
            const d = byDay[day]
            const pct = (d.cost / maxDayCost) * 100
            const minWidth = Math.max(8, Math.floor(600 / dayKeys.length))
            return (
              <div key={day} style={{ flex: 1, minWidth, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ width: '100%', background: 'var(--accent2)', borderRadius: '3px 3px 0 0', minHeight: 2, height: `${Math.max(2, pct)}%`, transition: 'height .3s' }} title={`${day}: ${fmtY(d.cost)} (${d.count}回)`} />
                {(dayKeys.length <= 14 || idx % Math.ceil(dayKeys.length / 10) === 0) && (
                  <div style={{ fontSize: 9, color: 'var(--text3)', whiteSpace: 'nowrap', transform: 'rotate(-45deg)', transformOrigin: 'top left', marginTop: 2 }}>{day.substring(5)}</div>
                )}
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)', marginTop: 24 }}>
          <span>¥0</span>
          <span>{fmtY(maxDayCost)}</span>
        </div>
      </div>

      {/* Recent requests */}
      <div className="section-title">直近のリクエスト (20件)</div>
      <div className="card" style={{ overflowX: 'auto', marginBottom: 24 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              {['日時', 'ソース', 'モデル', '入力', '出力', 'コスト'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {msgs.slice(0, 20).map((m, idx) => {
              const t = new Date(m.created_at)
              const timeStr = `${t.getMonth() + 1}/${t.getDate()} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`
              return (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                  {[timeStr, SOURCE_LABELS[m.source] || m.source || '-', m.model || '-', (m.tokens_input || 0).toLocaleString(), (m.tokens_output || 0).toLocaleString(), fmtY(parseFloat(String(m.cost_usd)) || 0)].map((val, i) => (
                    <td key={i} style={{ padding: '8px 12px', whiteSpace: 'nowrap', ...(i >= 2 ? { fontFamily: 'var(--mono)' } : {}) }}>{val}</td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* TTFT Analysis */}
      {chatMetrics.length > 0 && (
        <>
          <div className="section-title">TTFT Analysis (Time to First Token)</div>
          <div className="card" style={{ marginBottom: 24 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {['Model', 'Avg TTFT', 'Min', 'Max', 'P50', 'Samples'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.keys(ttftByModel).sort().map(mod => {
                  const vals = [...ttftByModel[mod]].sort((a, b) => a - b)
                  const avg = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length)
                  const p50 = vals[Math.floor(vals.length / 2)]
                  return (
                    <tr key={mod} style={{ borderBottom: '1px solid var(--border)' }}>
                      {[mod, `${avg}ms`, `${vals[0]}ms`, `${vals[vals.length - 1]}ms`, `${p50}ms`, vals.length].map((v, i) => (
                        <td key={i} style={{ padding: '8px 12px', fontFamily: 'var(--mono)', fontSize: 11 }}>{v}</td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Tool Usage */}
      {Object.keys(toolStats).length > 0 && (
        <>
          <div className="section-title">AI Chat Tool Usage</div>
          <div className="card" style={{ marginBottom: 24 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {['Tool', 'Calls', 'Avg Duration', 'Total Time', 'Share'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.keys(toolStats).sort((a, b) => toolStats[b].count - toolStats[a].count).map(name => {
                  const s = toolStats[name]
                  const avgMs = s.durations.length ? Math.round(s.totalMs / s.durations.length) : null
                  return (
                    <tr key={name} style={{ borderBottom: '1px solid var(--border)' }}>
                      {[name, s.count, avgMs !== null ? `${avgMs}ms` : '-', s.totalMs ? `${(s.totalMs / 1000).toFixed(1)}s` : '-', `${(s.count / totalCalls2 * 100).toFixed(1)}%`].map((v, i) => (
                        <td key={i} style={{ padding: '8px 12px', fontFamily: 'var(--mono)', fontSize: 11 }}>{v}</td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Response Time Distribution */}
      {withTime.length > 0 && (
        <>
          <div className="section-title">Response Time Distribution</div>
          <div className="card" style={{ marginBottom: 24, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 80 }}>
              {Object.keys(buckets).map(label => {
                const pct = (buckets[label] / maxBucket) * 100
                return (
                  <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text2)' }}>{buckets[label]}</div>
                    <div style={{ width: '100%', background: 'var(--accent2)', borderRadius: '4px 4px 0 0', height: `${Math.max(2, pct)}%` }} />
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>{label}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Claude Code Tool Usage */}
      {promptLogs.length > 0 && (
        <>
          <div className="section-title">Claude Code Tool Usage</div>
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="g3" style={{ marginBottom: 16 }}>
              {[
                { v: promptLogs.length, l: 'Prompts w/ Tools' },
                { v: totalTools, l: 'Total Tool Calls' },
                { v: promptLogs.length > 0 ? (totalTools / promptLogs.length).toFixed(1) : '0', l: 'Avg Tools/Prompt' },
              ].map(({ v, l }) => (
                <div key={l} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{v}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{l}</div>
                </div>
              ))}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {['Tool', 'Total Calls', 'Share', 'Bar'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.keys(ccToolStats).sort((a, b) => ccToolStats[b] - ccToolStats[a]).map(name => {
                  const cnt = ccToolStats[name]
                  return (
                    <tr key={name} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 500 }}>{name}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'var(--mono)', fontSize: 11 }}>{cnt}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'var(--mono)', fontSize: 11 }}>{(cnt / totalTools * 100).toFixed(1)}%</td>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ height: 8, borderRadius: 4, background: 'var(--accent2)', width: `${Math.round(cnt / maxToolCount * 100)}%` }} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
