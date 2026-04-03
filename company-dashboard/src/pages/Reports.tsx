import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PageHeader, EmptyState, SkeletonRows } from '@/components/ui'
import { marked } from 'marked'

interface Report {
  id: number
  title: string
  file_path: string
  file_type: string
  content: string | null
  tags: string[]
  status: string
  company_id: string | null
  created_at: string
  updated_at: string
}

interface NewsItem {
  id: number
  action: string
  metadata: { title?: string; summary?: string } | null
  created_at: string
}

type Tab = 'research' | 'news'

export function Reports() {
  const [tab, setTab] = useState<Tab>('research')

  return (
    <div className="page">
      <PageHeader title="Reports" description="調査レポート・ニュース" />

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--border)', paddingBottom: 0 }}>
        {([['research', '調査レポート'], ['news', 'ニュース']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              background: 'none', border: 'none', padding: '10px 20px', fontSize: 13,
              fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)',
              color: tab === id ? 'var(--accent)' : 'var(--text3)',
              borderBottom: tab === id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -2,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'research' ? <ResearchReports /> : <NewsFeed />}
    </div>
  )
}

/**
 * Safely render markdown into a DOM ref.
 * Uses marked for parsing, then DOM-based sanitization (strip scripts, on* handlers, dangerous hrefs).
 * Note: innerHTML is used intentionally after sanitization — content is from our own DB (artifacts table).
 */
function SafeMarkdown({ content }: { content: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current) return
    const html = marked.parse(content, { async: false }) as string
    const tpl = document.createElement('template')
    // eslint-disable-next-line -- sanitized below via DOM traversal
    tpl.innerHTML = html
    const frag = tpl.content
    frag.querySelectorAll('script,iframe,object,embed,form').forEach((el) => el.remove())
    frag.querySelectorAll('*').forEach((node) => {
      Array.from(node.attributes).forEach((attr) => {
        if (attr.name.startsWith('on')) node.removeAttribute(attr.name)
      })
    })
    frag.querySelectorAll('a').forEach((a) => {
      const href = (a.getAttribute('href') || '').trim().toLowerCase()
      if (href.startsWith('javascript:') || href.startsWith('data:')) {
        a.removeAttribute('href')
      }
      a.setAttribute('target', '_blank')
      a.setAttribute('rel', 'noopener noreferrer')
    })
    while (ref.current.firstChild) ref.current.removeChild(ref.current.firstChild)
    ref.current.appendChild(frag)
  }, [content])
  return <div ref={ref} className="md-body" style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text2)' }} />
}

function logFeedback(artifactId: number, feedback: string, filePath: string, tags: string[]) {
  supabase.from('activity_log').insert({
    action: 'artifact_feedback',
    metadata: { artifact_id: artifactId, feedback, file_path: filePath, tags },
  })
}

function ResearchReports() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const load = useCallback(() => {
    supabase
      .from('artifacts')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setReports((data as Report[]) || [])
        setLoading(false)
      })
  }, [])

  useEffect(() => { load() }, [load])

  // Log view when expanded
  useEffect(() => {
    if (expanded !== null) {
      const r = reports.find((x) => x.id === expanded)
      if (r) logFeedback(r.id, 'viewed', r.file_path, r.tags)
    }
  }, [expanded, reports])

  async function archiveReport(e: React.MouseEvent, r: Report) {
    e.stopPropagation()
    await supabase.from('artifacts').update({ status: 'archived' }).eq('id', r.id)
    logFeedback(r.id, 'archived', r.file_path, r.tags)
    setReports((prev) => prev.map((x) => x.id === r.id ? { ...x, status: 'archived' } : x))
  }

  async function restoreReport(e: React.MouseEvent, r: Report) {
    e.stopPropagation()
    await supabase.from('artifacts').update({ status: 'active' }).eq('id', r.id)
    setReports((prev) => prev.map((x) => x.id === r.id ? { ...x, status: 'active' } : x))
  }

  if (loading) return <SkeletonRows count={4} />

  const active = reports.filter((r) => r.status === 'active')
  const archived = reports.filter((r) => r.status === 'archived')

  if (active.length === 0 && !showArchived) return <EmptyState icon="📄" message="レポートはまだありません" />

  return (
    <div>
      {/* Company filter chips */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{active.length}件</span>
        {archived.length > 0 && (
          <button
            className="btn btn-g btn-sm"
            style={{ fontSize: 10, padding: '2px 8px', marginLeft: 'auto' }}
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? 'アーカイブを隠す' : `アーカイブ (${archived.length})`}
          </button>
        )}
      </div>

      {active.map((r) => (
        <ReportCard key={r.id} r={r} expanded={expanded === r.id}
          onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
          onArchive={(e) => archiveReport(e, r)}
        />
      ))}

      {showArchived && archived.length > 0 && (
        <>
          <div className="section-title" style={{ marginTop: 20 }}>Archived ({archived.length})</div>
          {archived.map((r) => (
            <ReportCard key={r.id} r={r} expanded={expanded === r.id}
              onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
              onRestore={(e) => restoreReport(e, r)}
              isArchived
            />
          ))}
        </>
      )}
    </div>
  )
}

function ReportCard({ r, expanded, onToggle, onArchive, onRestore, isArchived }: {
  r: Report; expanded: boolean; onToggle: () => void
  onArchive?: (e: React.MouseEvent) => void
  onRestore?: (e: React.MouseEvent) => void
  isArchived?: boolean
}) {
  return (
    <div className="card" style={{ marginBottom: 12, cursor: 'pointer', opacity: isArchived ? 0.6 : 1 }} onClick={onToggle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
            {r.title}
            {r.company_id && (
              <span style={{ fontSize: 10, marginLeft: 8, padding: '1px 6px', borderRadius: 4, background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                {r.company_id}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {r.tags.map((t) => (
              <span key={t} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--surface2)', color: 'var(--text3)' }}>{t}</span>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
            {new Date(r.created_at).toLocaleDateString('ja-JP')}
          </span>
          {onArchive && (
            <button onClick={onArchive} title="アーカイブ"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text3)', padding: '2px 4px' }}>
              ×
            </button>
          )}
          {onRestore && (
            <button onClick={onRestore} title="復元"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--accent)', padding: '2px 4px' }}>
              ↩
            </button>
          )}
        </div>
      </div>

      {expanded && r.content && (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <SafeMarkdown content={r.content} />
        </div>
      )}
    </div>
  )
}

function NewsFeed() {
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [collecting, setCollecting] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('activity_log')
      .select('id,action,metadata,created_at')
      .eq('action', 'intelligence_item')
      .order('created_at', { ascending: false })
      .limit(20)
    setItems((data as NewsItem[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function collectNews() {
    setCollecting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const res = await fetch(
        import.meta.env.VITE_SUPABASE_URL + '/functions/v1/ai-agent',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            message: '最新のAI/LLMニュース・技術動向を3-5件。タイトル+1行要約。日本語。箇条書き。日付付き。トピック: AI, LLM, データ基盤, Claude, OpenAI',
            model: 'gpt-5-nano',
            context_mode: 'none',
          }),
        },
      )
      if (res.ok) {
        const bodyText = await res.text()
        let text = ''
        bodyText.split('\n').forEach((line) => {
          if (line.startsWith('data: ')) {
            try {
              const evt = JSON.parse(line.slice(6))
              if (evt.type === 'delta' && evt.content) text += evt.content
            } catch { /* skip */ }
          }
        })
        if (text) {
          const lines = text.split('\n').filter((l) => l.trim().startsWith('-'))
          for (const line of lines) {
            await supabase.from('activity_log').insert({
              action: 'intelligence_item',
              metadata: { title: line.replace(/^-\s*/, '').substring(0, 200) },
            })
          }
          await load()
        }
      }
    } catch (e) {
      console.error('News collect error:', e)
    }
    setCollecting(false)
  }

  if (loading) return <SkeletonRows count={5} />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-g btn-sm" onClick={collectNews} disabled={collecting}>
          {collecting ? '収集中...' : '手動収集'}
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon="📰" message="ニュースはまだありません。「手動収集」で取得できます。" />
      ) : (
        <div className="card">
          {items.map((item, i) => (
            <div key={item.id} style={{
              padding: '10px 0',
              borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
              fontSize: 13,
            }}>
              <div style={{ color: 'var(--text)' }}>
                {item.metadata?.title || JSON.stringify(item.metadata).substring(0, 80)}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2, fontFamily: 'var(--mono)' }}>
                {new Date(item.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
