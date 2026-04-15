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
  title_ja: string | null
  summary: string
  url: string | null
  source: string
  topic: string
  published_date: string | null
  collected_at: string | null
}

type Tab = 'research' | 'news' | 'sources'

export function Reports() {
  const initialTab = window.location.hash === '#sources' ? 'sources' : 'research'
  const [tab, setTab] = useState<Tab>(initialTab)

  return (
    <div className="page">
      <PageHeader title="Reports" description="調査レポート・ニュース" />

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--border)', paddingBottom: 0 }}>
        {([['research', '調査レポート'], ['news', 'ニュース'], ['sources', 'ソース設定']] as const).map(([id, label]) => (
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

      {tab === 'research' ? <ResearchReports /> : tab === 'news' ? <NewsFeed /> : <SourceSettings />}
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

function formatNewsDate(item: ReportNewsItem): string {
  // published_date は YYYY-MM-DD の文字列。Date オブジェクト経由だと
  // タイムゾーン事故（UTC解釈でローカル時刻にずれる）が起きるので、
  // 文字列のまま直接パースする。
  const pub = item.published_date
  if (pub && /^\d{4}-\d{2}-\d{2}/.test(pub)) {
    const m = parseInt(pub.slice(5, 7), 10)
    const d = parseInt(pub.slice(8, 10), 10)
    return `${m}/${d}`
  }
  // collected_at は ISO datetime。こちらは JST に変換して表示
  const col = item.collected_at
  if (col) {
    const dt = new Date(col)
    if (!isNaN(dt.getTime())) {
      const jst = new Date(dt.getTime() + 9 * 60 * 60 * 1000)
      return `${jst.getUTCMonth() + 1}/${jst.getUTCDate()}`
    }
  }
  return ''
}

function NewsFeed() {
  const [items, setItems] = useState<ReportNewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [collecting, setCollecting] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [translatingId, setTranslatingId] = useState<string | null>(null)

  async function handleTranslate(id: string) {
    setTranslatingId(id)
    try {
      const { translateNewsItem } = await import('@/lib/newsCollect')
      const updated = await translateNewsItem(id)
      if (updated) {
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...updated } as ReportNewsItem : it)))
      }
    } catch (e) {
      console.error('[NewsFeed] translate error:', e)
    } finally {
      setTranslatingId(null)
    }
  }

  const load = useCallback(async () => {
    try {
      const { loadNews } = await import('@/lib/newsCollect')
      const news = await loadNews(30)
      setItems(news as ReportNewsItem[])
    } catch (e) {
      console.error('[NewsFeed] load error:', e)
      setItems([])
    } finally {
      setLoading(false)
    }
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
          {items.map((item, i) => {
            const isExpanded = expanded === item.id
            const dateLabel = formatNewsDate(item)
            return (
              <div
                key={item.id}
                style={{
                  padding: '12px 0',
                  borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
                  cursor: 'pointer',
                }}
                onClick={() => setExpanded(isExpanded ? null : (item.id || null))}
              >
                {/* Header row: date + title */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  {dateLabel && (
                    <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', minWidth: 36, flexShrink: 0 }}>
                      {dateLabel}
                    </span>
                  )}
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', flex: 1 }}>
                    {item.title_ja || item.title}
                  </span>
                </div>

                {/* Meta: source + topic */}
                <div style={{ display: 'flex', gap: 6, marginTop: 4, marginLeft: dateLabel ? 44 : 0, alignItems: 'center' }}>
                  {item.source && <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{item.source}</span>}
                  {item.topic && <span style={{ fontSize: 10, padding: '0 5px', borderRadius: 3, background: 'var(--surface2)', color: 'var(--accent2)' }}>{item.topic}</span>}
                </div>

                {/* Expanded: summary + link + translate action */}
                {isExpanded && (
                  <div style={{ marginTop: 10, marginLeft: dateLabel ? 44 : 0, padding: 12, background: 'var(--surface)', borderRadius: 6, border: '1px solid var(--border)' }}>
                    {item.summary && (
                      <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 10 }}>
                        {item.summary}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}
                        >
                          記事を読む →
                        </a>
                      )}
                      {item.id && (
                        <button
                          className="btn btn-g btn-sm"
                          style={{ fontSize: 11, padding: '3px 10px' }}
                          disabled={translatingId === item.id}
                          onClick={(e) => { e.stopPropagation(); handleTranslate(item.id!) }}
                        >
                          {translatingId === item.id ? '翻訳中…' : item.title_ja ? '日本語を再生成' : '日本語に翻訳'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Source Settings
// ============================================================

interface IntelligenceSource {
  id: number
  name: string
  source_type: string
  enabled: boolean
  priority: string
  config: Record<string, unknown>
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  keyword: 'キーワード検索',
  web_source: '公式ブログ / ニュース',
  tech_article: '技術記事プラットフォーム',
  github_release: 'GitHub Releases',
  hacker_news: 'Hacker News',
  x_account: 'X アカウント',
}

function SourceSettings() {
  const [sources, setSources] = useState<IntelligenceSource[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('keyword')
  const [newConfig, setNewConfig] = useState('')
  const [newPriority, setNewPriority] = useState('normal')

  useEffect(() => {
    supabase
      .from('intelligence_sources')
      .select('*')
      .order('source_type')
      .order('priority')
      .then(({ data }) => {
        setSources((data as IntelligenceSource[]) || [])
        setLoading(false)
      })
  }, [])

  const toggleSource = async (id: number, enabled: boolean) => {
    await supabase.from('intelligence_sources').update({ enabled: !enabled }).eq('id', id)
    setSources((prev) => prev.map((s) => s.id === id ? { ...s, enabled: !enabled } : s))
  }

  const deleteSource = async (id: number) => {
    await supabase.from('intelligence_sources').delete().eq('id', id)
    setSources((prev) => prev.filter((s) => s.id !== id))
  }

  const addSource = async () => {
    if (!newName.trim()) return
    let config: Record<string, unknown> = {}
    if (newType === 'keyword') config = { term: newConfig || newName }
    else if (newType === 'web_source') config = { url: newConfig }
    else if (newType === 'tech_article') config = { site: newConfig, keywords: [] }
    else if (newType === 'github_release') config = { repo: newConfig }
    else if (newType === 'hacker_news') config = { keywords: newConfig.split(',').map((s: string) => s.trim()), min_score: 10 }

    const { data } = await supabase
      .from('intelligence_sources')
      .insert({ name: newName.trim(), source_type: newType, config, priority: newPriority, enabled: true })
      .select()
      .single()

    if (data) {
      setSources((prev) => [...prev, data as IntelligenceSource])
      setNewName('')
      setNewConfig('')
      setAdding(false)
    }
  }

  if (loading) return <SkeletonRows count={5} />

  // Group by source_type
  const groups: Record<string, IntelligenceSource[]> = {}
  for (const s of sources) {
    if (!groups[s.source_type]) groups[s.source_type] = []
    groups[s.source_type].push(s)
  }

  const enabledCount = sources.filter((s) => s.enabled).length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
          {sources.length} ソース（有効: {enabledCount}）
        </div>
        <button className="btn btn-p btn-sm" onClick={() => setAdding(true)}>+ ソース追加</button>
      </div>

      {adding && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input className="input" placeholder="ソース名" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
            <div style={{ display: 'flex', gap: 8 }}>
              <select className="input" value={newType} onChange={(e) => setNewType(e.target.value)} style={{ flex: 1 }}>
                {Object.entries(SOURCE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select className="input" value={newPriority} onChange={(e) => setNewPriority(e.target.value)} style={{ width: 100 }}>
                <option value="high">高</option>
                <option value="normal">通常</option>
                <option value="low">低</option>
              </select>
            </div>
            <input className="input" placeholder={newType === 'keyword' ? '検索語' : newType === 'web_source' ? 'URL' : newType === 'github_release' ? 'owner/repo' : newType === 'hacker_news' ? 'キーワード（カンマ区切り）' : 'site ドメイン'} value={newConfig} onChange={(e) => setNewConfig(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-g btn-sm" onClick={() => setAdding(false)}>キャンセル</button>
              <button className="btn btn-p btn-sm" onClick={addSource} disabled={!newName.trim()}>追加</button>
            </div>
          </div>
        </div>
      )}

      {Object.entries(SOURCE_TYPE_LABELS).map(([type, label]) => {
        const items = groups[type]
        if (!items || items.length === 0) return null
        return (
          <div key={type} style={{ marginBottom: 20 }}>
            <div className="section-title">{label} ({items.length})</div>
            <div className="card">
              {items.map((src) => {
                const cfg = src.config || {}
                let detail = ''
                if (src.source_type === 'keyword') detail = `検索語: "${cfg.term || ''}"`
                else if (src.source_type === 'web_source') detail = (cfg.url as string) || ''
                else if (src.source_type === 'tech_article') detail = `site:${cfg.site || ''} | ${((cfg.keywords as string[]) || []).join(', ')}`
                else if (src.source_type === 'github_release') detail = (cfg.repo as string) || ''
                else if (src.source_type === 'hacker_news') detail = `キーワード: ${((cfg.keywords as string[]) || []).join(', ')} (min: ${cfg.min_score || 0}pt)`

                return (
                  <div key={src.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                    <button
                      className="btn btn-g btn-sm"
                      style={{ fontSize: 10, padding: '2px 8px', minWidth: 36, color: src.enabled ? 'var(--green)' : 'var(--red)' }}
                      onClick={() => toggleSource(src.id, src.enabled)}
                    >
                      {src.enabled ? 'ON' : 'OFF'}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500 }}>{src.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>{detail}</div>
                    </div>
                    <span style={{
                      fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 3,
                      color: src.priority === 'high' ? 'var(--red)' : src.priority === 'low' ? 'var(--text3)' : 'var(--blue)',
                      background: src.priority === 'high' ? 'var(--red-bg)' : 'var(--surface2)',
                    }}>
                      {src.priority}
                    </span>
                    <button className="btn btn-g btn-sm" style={{ fontSize: 10, padding: '2px 6px', color: 'var(--red)' }} onClick={() => deleteSource(src.id)}>
                      削除
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
