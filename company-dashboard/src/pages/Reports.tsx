import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PageHeader, EmptyState, SkeletonRows } from '@/components/ui'
import { marked } from 'marked'

interface Report {
  id: number
  title: string
  description: string | null
  file_path: string
  file_type: string
  content: string | null
  tags: string[]
  status: string
  company_id: string | null
  created_at: string
  updated_at: string
}

interface ReportNewsItem {
  id: string
  title: string
  summary: string
  url: string | null
  source: string
  topic: string
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
      .select('id,title,description,file_path,file_type,company_id,tags,status,created_at,updated_at')
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
          onToggle={async () => {
            if (expanded === r.id) { setExpanded(null); return }
            // Lazy-load content on first expand
            if (!r.content) {
              const { data } = await supabase.from('artifacts').select('content').eq('id', r.id).single()
              if (data?.content) {
                setReports((prev) => prev.map((x) => x.id === r.id ? { ...x, content: data.content } : x))
              }
            }
            setExpanded(r.id)
          }}
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

/** Extract a brief summary from markdown content */
function extractSummary(content: string | null, maxLen = 120): string | null {
  if (!content) return null
  const lines = content.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    // Skip headings, empty lines, metadata, separators
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('---') || trimmed.startsWith('|') || trimmed.startsWith('対象期間') || trimmed.startsWith('収集方法')) continue
    // Skip lines that are just formatting
    if (/^[*_\-=]+$/.test(trimmed)) continue
    // Clean markdown formatting
    const clean = trimmed.replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/^[-*]\s*/, '')
    if (clean.length > 10) return clean.length > maxLen ? clean.substring(0, maxLen) + '...' : clean
  }
  return null
}

function ReportCard({ r, expanded, onToggle, onArchive, onRestore, isArchived }: {
  r: Report; expanded: boolean; onToggle: () => void
  onArchive?: (e: React.MouseEvent) => void
  onRestore?: (e: React.MouseEvent) => void
  isArchived?: boolean
}) {
  const summary = !expanded ? (r.description || extractSummary(r.content)) : null

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
          {summary && (
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4, lineHeight: 1.5 }}>
              {summary}
            </div>
          )}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            {r.tags.map((t) => (
              <span key={t} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--surface2)', color: 'var(--text3)' }}>{t}</span>
            ))}
            <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{r.file_type}</span>
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
          {r.file_type === 'html' ? (
            <iframe
              srcDoc={r.content}
              style={{ width: '100%', height: '80vh', border: '1px solid var(--border)', borderRadius: 'var(--r)', background: '#fff' }}
              sandbox="allow-same-origin"
              title={r.title}
            />
          ) : (
            <SafeMarkdown content={r.content} />
          )}
        </div>
      )}
    </div>
  )
}

function NewsFeed() {
  const [items, setItems] = useState<ReportNewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [collecting, setCollecting] = useState(false)

  const load = useCallback(async () => {
    const { loadNews } = await import('@/lib/newsCollect')
    const news = await loadNews(20)
    setItems(news as ReportNewsItem[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCollect() {
    setCollecting(true)
    try {
      const { collectNews } = await import('@/lib/newsCollect')
      const { count } = await collectNews()
      if (count > 0) await load()
    } catch (e) {
      console.error('News collect error:', e)
    }
    setCollecting(false)
  }

  if (loading) return <SkeletonRows count={5} />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-g btn-sm" onClick={handleCollect} disabled={collecting}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text)', fontWeight: 500, textDecoration: 'none' }}>{item.title}</a>
                ) : (
                  <span style={{ color: 'var(--text)', fontWeight: 500 }}>{item.title}</span>
                )}
              </div>
              {item.summary && (
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3, lineHeight: 1.5 }}>
                  {item.summary}
                </div>
              )}
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3, fontFamily: 'var(--mono)', display: 'flex', gap: 8 }}>
                {item.source && <span>{item.source}</span>}
                {item.topic && <span style={{ color: 'var(--accent2)' }}>{item.topic}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
