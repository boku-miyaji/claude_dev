import { useEffect, useState, useCallback } from 'react'
import { PageHeader } from '@/components/ui'
import { supabase } from '@/lib/supabase'

// ============================================================
// Types
// ============================================================

interface Company { id: string; name: string }

interface PromptEntry {
  id: string
  prompt: string
  created_at: string
  context?: string
  session_id?: string
  company_id?: string
  tags?: string[]
  companies?: { name: string }
}

interface PromptSession {
  id: string
  started_at: string
  ended_at?: string
  company_id?: string
  prompt_count?: number
  knowledge_extracted?: boolean
  tags?: string[]
  companies?: { name: string }
}

const PAGE_SIZE = 20

function PromptRow({ p }: { p: PromptEntry }) {
  const time = new Date(p.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  const coName = p.companies ? p.companies.name : (p.context || 'HD')
  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>{time}</span>
        <span className="tag tag-normal">{coName}</span>
        {(p.tags || []).map(t => <span key={t} className="tag tag-co" style={{ marginRight: 4 }}>{t}</span>)}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 120, overflow: 'hidden' }}>{p.prompt}</div>
    </div>
  )
}

// ============================================================
// Main Component
// ============================================================

export function Prompts() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [filterCompany, setFilterCompany] = useState('')
  const [viewMode, setViewMode] = useState<'session' | 'flat'>('session')
  const [currentPage, setCurrentPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [sessions, setSessions] = useState<PromptSession[]>([])
  const [flatPrompts, setFlatPrompts] = useState<PromptEntry[]>([])
  const [expandedSessions, setExpandedSessions] = useState<Record<string, PromptEntry[] | null | undefined>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('companies').select('id,name').eq('status', 'active').then(({ data }) => setCompanies(data || []))
  }, [])

  const loadSessionView = useCallback(async () => {
    let countQuery = supabase.from('prompt_sessions').select('id', { count: 'exact', head: true })
    if (filterCompany) countQuery = countQuery.eq('company_id', filterCompany)
    const countRes = await countQuery
    const total = countRes.count || 0
    setTotalCount(total)

    const offset = currentPage * PAGE_SIZE
    let sessQuery = supabase.from('prompt_sessions').select('*,companies(name)').order('started_at', { ascending: false }).range(offset, offset + PAGE_SIZE - 1)
    if (filterCompany) sessQuery = sessQuery.eq('company_id', filterCompany)
    const sessRes = await sessQuery
    setSessions(sessRes.data || [])
    setLoading(false)
  }, [filterCompany, currentPage])

  const loadFlatView = useCallback(async () => {
    const countRes = await supabase.from('prompt_log').select('id', { count: 'exact', head: true })
    const total = countRes.count || 0
    setTotalCount(total)

    const offset = currentPage * PAGE_SIZE * 2
    let query = supabase.from('prompt_log').select('*,companies(name)').order('created_at', { ascending: false }).range(offset, offset + PAGE_SIZE * 2 - 1)
    if (filterCompany) query = query.eq('company_id', filterCompany)
    const res = await query
    setFlatPrompts(res.data || [])
    setLoading(false)
  }, [filterCompany, currentPage])

  useEffect(() => {
    setLoading(true)
    setExpandedSessions({})
    if (viewMode === 'session') loadSessionView()
    else loadFlatView()
  }, [viewMode, filterCompany, currentPage, loadSessionView, loadFlatView])

  const toggleSession = async (sess: PromptSession) => {
    const key = sess.id
    if (expandedSessions[key] !== undefined) {
      setExpandedSessions(prev => ({ ...prev, [key]: prev[key] === null ? null : undefined }))
      // toggle collapse
      if (expandedSessions[key] !== null) {
        setExpandedSessions(prev => { const n = { ...prev }; delete n[key]; return n })
      } else {
        setExpandedSessions(prev => ({ ...prev, [key]: undefined }))
      }
      return
    }
    // Mark as loading
    setExpandedSessions(prev => ({ ...prev, [key]: null }))
    const res = await supabase.from('prompt_log').select('*,companies(name)').eq('session_id', sess.id).order('created_at', { ascending: true })
    setExpandedSessions(prev => ({ ...prev, [key]: res.data || [] }))
  }

  const collapseSession = (id: string) => {
    setExpandedSessions(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  const isExpanded = (id: string) => id in expandedSessions

  // Group by date
  const groupByDate = <T extends { started_at?: string; created_at?: string }>(items: T[]): Record<string, T[]> => {
    const g: Record<string, T[]> = {}
    items.forEach(item => {
      const dateStr = item.started_at || item.created_at || ''
      const d = new Date(dateStr).toLocaleDateString('ja-JP')
      if (!g[d]) g[d] = []
      g[d].push(item)
    })
    return g
  }

  const flatPageSize = PAGE_SIZE * 2
  const totalPages = viewMode === 'session'
    ? Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
    : Math.max(1, Math.ceil(totalCount / flatPageSize))

  return (
    <div className="page">
      <PageHeader title="Prompt History" description="社長の入力プロンプト履歴（セッション別・会社別）" />

      {/* Filter bar */}
      <div className="filter-bar" style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <select className="input" value={filterCompany} onChange={e => { setFilterCompany(e.target.value); setCurrentPage(0) }}>
          <option value="">All Companies</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text3)', marginRight: 4 }}>View:</span>
          <button className="btn" style={{ fontSize: 11, padding: '4px 12px', opacity: viewMode === 'session' ? 1 : 0.5 }} onClick={() => { setViewMode('session'); setCurrentPage(0) }}>Session</button>
          <button className="btn" style={{ fontSize: 11, padding: '4px 12px', opacity: viewMode === 'flat' ? 1 : 0.5 }} onClick={() => { setViewMode('flat'); setCurrentPage(0) }}>Flat</button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="card" style={{ padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Loading...</div>
        </div>
      ) : viewMode === 'session' ? (
        <>
          {sessions.length === 0 ? (
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>セッションデータがまだありません。新しいプロンプトからセッション単位で記録されます。</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Flat ビューで従来の表示を確認できます。</div>
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="g3" style={{ marginBottom: 20 }}>
                <div className="card kpi"><div className="kpi-val">{totalCount}</div><div className="kpi-lbl">Total Sessions</div></div>
                <div className="card kpi"><div className="kpi-val">{sessions.reduce((s, sess) => s + (sess.prompt_count || 0), 0)}</div><div className="kpi-lbl">Prompts (this page)</div></div>
                <div className="card kpi"><div className="kpi-val">{sessions.filter(s => s.knowledge_extracted).length}/{sessions.length}</div><div className="kpi-lbl">Knowledge Extracted</div></div>
              </div>

              {/* Sessions grouped by date */}
              {Object.entries(groupByDate(sessions)).map(([date, daySessions]) => (
                <div key={date}>
                  <div className="section-title" style={{ marginTop: 20 }}>{date} ({daySessions.length} sessions)</div>
                  {daySessions.map(sess => {
                    const startTime = new Date(sess.started_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
                    const endTime = sess.ended_at ? new Date(sess.ended_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '...'
                    const coName = sess.companies ? sess.companies.name : 'HD'
                    const sessTags = (sess.tags || []).slice(0, 6)
                    const expanded = isExpanded(sess.id)
                    const sessPrompts = expandedSessions[sess.id] ?? undefined
                    return (
                      <div key={sess.id} className="card" style={{ marginBottom: 8, overflow: 'hidden' }}>
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '12px 14px', background: expanded ? 'var(--bg2)' : '' }}
                          onClick={() => expanded ? collapseSession(sess.id) : toggleSession(sess)}
                        >
                          <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>{startTime} → {endTime}</span>
                          <span className="tag tag-normal">{coName}</span>
                          <span style={{ fontSize: 12, color: 'var(--text2)' }}>{sess.prompt_count || 0} prompts</span>
                          {sessTags.map(t => <span key={t} className="tag tag-co" style={{ fontSize: 10 }}>{t}</span>)}
                          <span style={{ fontSize: 10, color: sess.knowledge_extracted ? 'var(--green)' : 'var(--text3)', marginLeft: 'auto' }}>
                            {sess.knowledge_extracted ? '📚 extracted' : '○ pending'}
                          </span>
                        </div>
                        {expanded && (
                          <div style={{ padding: '8px 0 4px 0' }}>
                            {!sessPrompts ? (
                              <div style={{ padding: '8px 14px', fontSize: 12, color: 'var(--text3)' }}>Loading...</div>
                            ) : sessPrompts.length === 0 ? (
                              <div style={{ padding: '8px 14px', fontSize: 12, color: 'var(--text3)' }}>No prompts found</div>
                            ) : (
                              <div style={{ padding: '0 14px' }}>
                                {sessPrompts.map(p => <PromptRow key={p.id} p={p} />)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </>
          )}
        </>
      ) : (
        <>
          {flatPrompts.length === 0 ? (
            <div className="card">
              <div className="empty">プロンプト履歴なし。/company でやりとりすると自動記録されます</div>
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="g3" style={{ marginBottom: 20 }}>
                <div className="card kpi"><div className="kpi-val">{totalCount}</div><div className="kpi-lbl">Total Prompts</div></div>
                <div className="card kpi"><div className="kpi-val">{Object.keys(groupByDate(flatPrompts.map(p => ({ ...p, started_at: p.created_at })))).length}</div><div className="kpi-lbl">Days (this page)</div></div>
                <div className="card kpi"><div className="kpi-val">{companies.length}</div><div className="kpi-lbl">Companies</div></div>
              </div>

              {/* Grouped by date */}
              {Object.entries(groupByDate(flatPrompts.map(p => ({ ...p, started_at: p.created_at })))).map(([date, dayPrompts]) => (
                <div key={date}>
                  <div className="section-title" style={{ marginTop: 20 }}>{date} ({dayPrompts.length})</div>
                  <div className="card">
                    {dayPrompts.map(p => <PromptRow key={p.id} p={p} />)}
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}

      {/* Pagination */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, justifyContent: 'center' }}>
        <button className="btn" style={{ fontSize: 12, padding: '6px 14px' }} disabled={currentPage <= 0} onClick={() => setCurrentPage(p => p - 1)}>← 前</button>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{currentPage + 1} / {totalPages} ({totalCount} {viewMode === 'session' ? 'sessions' : '件'})</span>
        <button className="btn" style={{ fontSize: 12, padding: '6px 14px' }} disabled={currentPage >= totalPages - 1} onClick={() => setCurrentPage(p => p + 1)}>次 →</button>
      </div>
    </div>
  )
}
