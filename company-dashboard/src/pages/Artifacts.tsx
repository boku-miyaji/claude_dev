import { useEffect, useState, useRef, useMemo } from 'react'
import { PageHeader, EmptyState } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { renderMarkdownSafe } from '@/lib/markdown'

// ============================================================
// Types
// ============================================================

// Markdown body: sanitized by renderMarkdownSafe which strips script tags and on* handlers
function MarkdownBody({ text, isFullscreen = false }: { text: string; isFullscreen?: boolean }) {
  const html = useMemo(() => renderMarkdownSafe(text), [text])
  // eslint-disable-next-line react/no-danger -- sanitized by renderMarkdownSafe
  return <div className="md-body" style={{ fontSize: 14, lineHeight: 1.7, overflow: 'auto', maxHeight: isFullscreen ? 'calc(100dvh - 80px)' : 'calc(100dvh - 280px)', padding: '0 4px' }} dangerouslySetInnerHTML={{ __html: html }} />
}

interface Company { id: string; name: string }

interface Artifact {
  id: string
  title: string
  file_path: string
  file_type: string
  company_id?: string
  last_synced_at?: string
  status: string
  created_at: string
  updated_at: string
  content?: string
  description?: string
  companies?: { name: string } | { name: string }[] | null
}

interface ArtifactComment {
  id: string
  artifact_id: string
  body: string
  source: string
  status: string
  created_at: string
  resolved_by?: string
  resolved_at?: string
}

// ============================================================
// Comment Popover
// ============================================================

function CommentPopover({ artifact }: { artifact: Artifact; onClose?: () => void }) {
  const [comments, setComments] = useState<ArtifactComment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('artifact_comments').select('*').eq('artifact_id', artifact.id).order('created_at', { ascending: false }).then(({ data }) => {
      setComments((data || []).filter((c: ArtifactComment) => c.status === 'open'))
      setLoading(false)
    })
  }, [artifact.id])

  return (
    <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, zIndex: 999, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', width: 320, maxHeight: 360, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>{artifact.title} — コメント</div>
      {loading ? (
        <div style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>読み込み中...</div>
      ) : comments.length === 0 ? (
        <div style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>コメントなし</div>
      ) : comments.map(c => {
        const time = new Date(c.created_at).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        const srcLabel = c.source === 'dashboard' ? '🌐' : c.source === 'claude' ? '🤖' : '📱'
        return (
          <div key={c.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, lineHeight: 1.5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>{srcLabel} {c.source}</span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>{time}</span>
            </div>
            <div style={{ color: 'var(--text1)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.body}</div>
          </div>
        )
      })}
    </div>
  )
}

// ============================================================
// Artifact Detail View
// ============================================================

function ArtifactDetail({ artifact: initialArtifact, onBack }: { artifact: Artifact; onBack: () => void }) {
  const [artifact, setArtifact] = useState(initialArtifact)
  const [comments, setComments] = useState<ArtifactComment[]>([])
  const [showResolved, setShowResolved] = useState(false)
  const [commentInput, setCommentInput] = useState('')
  const [reloading, setReloading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [fullscreen, setFullscreen] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const loadComments = async () => {
    const res = await supabase.from('artifact_comments').select('*').eq('artifact_id', artifact.id).order('created_at', { ascending: true })
    setComments(res.data || [])
  }

  useEffect(() => { loadComments() }, [artifact.id])

  const reload = async () => {
    setReloading(true)
    const res = await supabase.from('artifacts').select('*,companies(name)').eq('id', artifact.id).single()
    if (res.data) setArtifact(res.data)
    setReloading(false)
  }

  const archive = async () => {
    if (!confirm('この成果物の追跡を停止しますか？')) return
    await supabase.from('artifacts').update({ status: 'archived' }).eq('id', artifact.id)
    onBack()
  }

  const postComment = async () => {
    const body = commentInput.trim()
    if (!body) return
    await supabase.from('artifact_comments').insert({ artifact_id: artifact.id, body, source: 'dashboard' })
    setCommentInput('')
    loadComments()
  }

  const resolveComment = async (cid: string) => {
    await supabase.from('artifact_comments').update({ status: 'resolved', resolved_by: 'manual', resolved_at: new Date().toISOString() }).eq('id', cid)
    loadComments()
  }

  const saveEdit = async (cid: string) => {
    const body = editBody.trim()
    if (!body) return
    await supabase.from('artifact_comments').update({ body }).eq('id', cid)
    setEditingId(null)
    loadComments()
  }

  const coName = artifact.companies ? (Array.isArray(artifact.companies) ? artifact.companies[0]?.name : artifact.companies.name) ?? 'HD' : 'HD'
  const filtered = showResolved ? comments : comments.filter(c => c.status === 'open')
  const resolvedCount = comments.filter(c => c.status !== 'open').length

  // Render HTML iframe
  useEffect(() => {
    if (artifact.file_type === 'html' && artifact.content && iframeRef.current) {
      const iframe = iframeRef.current
      const viewportMeta = '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">'
      const responsiveStyle = '<style>body{max-width:100%;overflow-x:hidden;word-wrap:break-word}img,table,pre{max-width:100%;overflow-x:auto}*{box-sizing:border-box}</style>'
      let content = artifact.content
      if (content.indexOf('<head>') !== -1) {
        content = content.replace('<head>', '<head>' + viewportMeta + responsiveStyle)
      } else if (content.indexOf('<html>') !== -1) {
        content = content.replace('<html>', '<html><head>' + viewportMeta + responsiveStyle + '</head>')
      } else {
        content = '<!DOCTYPE html><html><head>' + viewportMeta + responsiveStyle + '</head><body>' + content + '</body></html>'
      }
      iframe.contentDocument?.open()
      iframe.contentDocument?.write(content)
      iframe.contentDocument?.close()
    }
  }, [artifact.file_type, artifact.content, fullscreen])

  const renderContent = (isFullscreen: boolean = false) => {
    if (!artifact.content) return <div className="empty">未同期。次のセッション起動時に自動同期されます。</div>
    if (artifact.file_type === 'html') {
      return <iframe ref={iframeRef} style={{ width: '100%', height: isFullscreen ? 'calc(100dvh - 80px)' : 'calc(100dvh - 200px)', minHeight: 400, border: 'none', background: '#fff', borderRadius: 8 }} />
    }
    if (artifact.file_type === 'md') {
      return <MarkdownBody text={artifact.content} isFullscreen={isFullscreen} />
    }
    return <pre style={{ fontSize: 12, overflow: 'auto', maxHeight: isFullscreen ? 'calc(100dvh - 80px)' : 'calc(100dvh - 280px)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{artifact.content}</pre>
  }

  return (
    <div>
      {/* Fullscreen overlay */}
      {fullscreen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 500,
          background: 'var(--bg)', overflow: 'auto',
          paddingTop: 'max(16px, env(safe-area-inset-top))',
          paddingRight: 'max(16px, env(safe-area-inset-right))',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
          paddingLeft: 'max(16px, env(safe-area-inset-left))',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{artifact.title}</span>
            <button className="btn" style={{ fontSize: 12 }} onClick={() => setFullscreen(false)}>✕ 閉じる</button>
          </div>
          {renderContent(true)}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button className="btn" style={{ fontSize: 12 }} onClick={onBack}>← 一覧に戻る</button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" style={{ fontSize: 12 }} onClick={() => setFullscreen(true)}>全画面</button>
          <button className="btn" style={{ fontSize: 12 }} disabled={reloading} onClick={reload}>{reloading ? '更新中...' : '↻ 更新'}</button>
          <button className="btn" style={{ fontSize: 12, color: 'var(--red)' }} onClick={archive}>アーカイブ（追跡停止）</button>
        </div>
      </div>

      <div className="page-title" style={{ fontSize: '1.2rem' }}>{artifact.title}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <span className="tag tag-normal">{coName}</span>
        <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>{artifact.file_path}</span>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{artifact.file_type.toUpperCase()}</span>
      </div>

      <div className="card" style={{ marginBottom: 20, overflow: 'auto' }}>
        {!fullscreen && renderContent()}
      </div>

      {/* Comments */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="section-title" style={{ marginBottom: 0 }}>コメント</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text3)', cursor: 'pointer' }}>
          <input type="checkbox" checked={showResolved} onChange={e => setShowResolved(e.target.checked)} />
          解決済みを表示
        </label>
      </div>
      <div>
        {comments.length === 0 ? (
          <div style={{ color: 'var(--text3)', fontSize: 13, padding: '8px 0' }}>コメントなし</div>
        ) : filtered.length === 0 && !showResolved && resolvedCount > 0 ? (
          <div style={{ color: 'var(--text3)', fontSize: 13, padding: '8px 0' }}>{resolvedCount}件の解決済みコメント（トグルで表示）</div>
        ) : filtered.map(c => {
          const time = new Date(c.created_at).toLocaleString('ja-JP')
          const statusColor = c.status === 'open' ? 'var(--orange)' : 'var(--green)'
          const statusText = c.status === 'open' ? 'OPEN' : c.status.toUpperCase()
          return (
            <div key={c.id} className="card" style={{ marginBottom: 8, padding: 12, opacity: c.status !== 'open' ? 0.6 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: `${statusColor}22`, color: statusColor, fontWeight: 600 }}>{statusText}</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{c.source}</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{time}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button className="btn" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => { setEditingId(c.id); setEditBody(c.body) }}>✎ 編集</button>
                  {c.status === 'open' && <button className="btn" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => resolveComment(c.id)}>✓ 解決</button>}
                </div>
              </div>
              {editingId === c.id ? (
                <div>
                  <textarea className="input" style={{ minHeight: 50, resize: 'vertical', fontSize: 13 }} value={editBody} onChange={e => setEditBody(e.target.value)} />
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <button className="btn btn-primary" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => saveEdit(c.id)}>保存</button>
                    <button className="btn" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => setEditingId(null)}>キャンセル</button>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{c.body}</div>
              )}
            </div>
          )
        })}
      </div>

      <textarea className="input" placeholder="コメントを追加..." style={{ minHeight: 60, marginTop: 12, resize: 'vertical' }} value={commentInput} onChange={e => setCommentInput(e.target.value)} />
      <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={postComment}>コメント投稿</button>
    </div>
  )
}

// ============================================================
// Artifact List
// ============================================================

function ArtifactCard({ artifact, commentCount, onSelect, onArchive }: { artifact: Artifact; commentCount: number; onSelect: () => void; onArchive: () => void }) {
  const [showPopover, setShowPopover] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const badgeRef = useRef<HTMLSpanElement>(null)
  const coName = artifact.companies ? (Array.isArray(artifact.companies) ? artifact.companies[0]?.name : artifact.companies.name) ?? 'HD' : 'HD'
  const synced = artifact.last_synced_at ? new Date(artifact.last_synced_at).toLocaleString('ja-JP') : '未同期'

  const handleArchive = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`「${artifact.title}」をアーカイブしますか？\n（追跡停止。ダッシュボード一覧から非表示になります）`)) return
    setArchiving(true)
    const { error } = await supabase.from('artifacts').update({ status: 'archived' }).eq('id', artifact.id)
    if (error) {
      alert(`アーカイブに失敗しました: ${error.message}`)
      setArchiving(false)
      return
    }
    onArchive()
  }

  useEffect(() => {
    if (!showPopover) return
    const handler = (e: MouseEvent) => {
      if (badgeRef.current && !badgeRef.current.contains(e.target as Node)) {
        setShowPopover(false)
      }
    }
    setTimeout(() => document.addEventListener('click', handler), 0)
    return () => document.removeEventListener('click', handler)
  }, [showPopover])

  return (
    <div className="card" style={{ cursor: 'pointer', marginBottom: 12 }} onClick={onSelect}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{artifact.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{artifact.file_path}</div>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span className="tag tag-normal">{coName}</span>
            <span
              ref={badgeRef}
              style={{ position: 'relative', background: commentCount > 0 ? 'var(--orange)' : undefined, color: commentCount > 0 ? '#000' : 'var(--text3)', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: commentCount > 0 ? 600 : undefined, cursor: 'pointer' }}
              onClick={e => { e.stopPropagation(); setShowPopover(v => !v) }}
            >
              {commentCount > 0 ? `${commentCount} コメント` : 'コメントなし'}
              {showPopover && <CommentPopover artifact={artifact} onClose={() => setShowPopover(false)} />}
            </span>
            <button
              className="btn"
              title="アーカイブ（追跡停止）"
              disabled={archiving}
              onClick={handleArchive}
              style={{ fontSize: 11, padding: '2px 8px', color: 'var(--text3)', opacity: archiving ? 0.5 : 0.7 }}
            >
              {archiving ? '...' : '🗄 アーカイブ'}
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>同期: {synced}</div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Main Component
// ============================================================

export function Artifacts() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [filterCompany, setFilterCompany] = useState('')
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)

  // Check hash for direct artifact link
  useEffect(() => {
    const hash = window.location.hash.replace('#', '').split('/')
    if (hash[0] === 'artifacts' && hash[1]) {
      supabase.from('artifacts').select('*,companies(name)').eq('id', hash[1]).single().then(({ data }) => {
        if (data) setSelectedArtifact(data)
      })
    }
  }, [])

  useEffect(() => {
    supabase.from('companies').select('id,name').eq('status', 'active').then(({ data }) => setCompanies(data || []))
  }, [])

  const loadList = async (company: string) => {
    setLoading(true)
    let query = supabase.from('artifacts').select('id,title,file_path,file_type,company_id,last_synced_at,status,created_at,updated_at,companies(name)').eq('status', 'active').not('file_path', 'like', '.company/departments/intelligence/reports/%').order('updated_at', { ascending: false }).limit(30)
    if (company) query = query.eq('company_id', company)
    const res = await query
    const arts = res.data || []
    setArtifacts(arts)
    setHasMore(arts.length >= 30)

    if (arts.length > 0) {
      const ids = arts.map((a: Artifact) => a.id)
      const commentRes = await supabase.from('artifact_comments').select('artifact_id').eq('status', 'open').in('artifact_id', ids)
      const counts: Record<string, number> = {}
      ;(commentRes.data || []).forEach((c: { artifact_id: string }) => { counts[c.artifact_id] = (counts[c.artifact_id] || 0) + 1 })
      setCommentCounts(counts)
    }
    setLoading(false)
  }

  useEffect(() => { loadList(filterCompany) }, [filterCompany])

  const loadMore = async () => {
    setLoadingMore(true)
    const offset = artifacts.length
    let query = supabase.from('artifacts').select('id,title,file_path,file_type,company_id,last_synced_at,status,created_at,updated_at,companies(name)').eq('status', 'active').not('file_path', 'like', '.company/departments/intelligence/reports/%').order('updated_at', { ascending: false }).range(offset, offset + 29)
    if (filterCompany) query = query.eq('company_id', filterCompany)
    const res = await query
    const moreArts = res.data || []
    if (moreArts.length > 0) {
      const moreIds = moreArts.map((a: Artifact) => a.id)
      const moreCommentRes = await supabase.from('artifact_comments').select('artifact_id').eq('status', 'open').in('artifact_id', moreIds)
      const moreCounts: Record<string, number> = { ...commentCounts }
      ;(moreCommentRes.data || []).forEach((c: { artifact_id: string }) => { moreCounts[c.artifact_id] = (moreCounts[c.artifact_id] || 0) + 1 })
      setCommentCounts(moreCounts)
      setArtifacts(prev => [...prev, ...moreArts])
      setHasMore(moreArts.length >= 30)
    } else {
      setHasMore(false)
    }
    setLoadingMore(false)
  }

  const handleSelect = async (art: Artifact) => {
    window.location.hash = `artifacts/${art.id}`
    const full = await supabase.from('artifacts').select('*,companies(name)').eq('id', art.id).single()
    setSelectedArtifact(full.data || art)
  }

  const handleBack = () => {
    window.location.hash = 'artifacts'
    setSelectedArtifact(null)
  }

  if (selectedArtifact) {
    return (
      <div className="page">
        <ArtifactDetail artifact={selectedArtifact} onBack={handleBack} />
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader title="Artifacts" description="成果物の確認・コメント。Claude Code で /register path/to/file.md で登録。" />

      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <select className="input" value={filterCompany} onChange={e => setFilterCompany(e.target.value)}>
          <option value="">All</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="skeleton-card" style={{ height: 200 }} />
      ) : artifacts.length === 0 ? (
        <EmptyState icon="📄" message="まだ成果物が登録されていません。Claude Code で /register path/to/file.md で登録できます。" />
      ) : (
        <>
          {artifacts.map(art => (
            <ArtifactCard
              key={art.id}
              artifact={art}
              commentCount={commentCounts[art.id] || 0}
              onSelect={() => handleSelect(art)}
              onArchive={() => setArtifacts(prev => prev.filter(a => a.id !== art.id))}
            />
          ))}
          {hasMore && (
            <button className="btn" style={{ width: '100%', marginTop: 8, padding: 10 }} disabled={loadingMore} onClick={loadMore}>
              {loadingMore ? '読み込み中...' : 'さらに読み込む'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
