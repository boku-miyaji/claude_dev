import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PageHeader, EmptyState, SkeletonRows } from '@/components/ui'
import { marked } from 'marked'
import {
  adoptSuggestion,
  checkSuggestion,
  dismissSuggestion,
  markImplemented,
  rejectSuggestion,
} from '@/lib/intelligenceSuggestions'
import type {
  IntelligenceSuggestion,
  SuggestionPriority,
  SuggestionStatus,
  SuggestionTarget,
} from '@/types/intelligence'

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

// ============================================================
// Suggestions Tab (intelligence_suggestions from News reports)
// ============================================================

const PRIORITY_COLORS: Record<SuggestionPriority, string> = {
  high: 'var(--red)',
  medium: 'var(--amber)',
  low: 'var(--text3)',
}

const TARGET_LABELS: Record<SuggestionTarget, string> = {
  'focus-you': 'focus-you',
  'hd-ops': 'HD運営',
  'both': '共通',
}
const TARGET_COLORS: Record<SuggestionTarget, string> = {
  'focus-you': 'var(--accent)',
  'hd-ops': 'var(--blue)',
  'both': 'var(--green)',
}

const STATUS_LABELS: Record<SuggestionStatus, string> = {
  new: '未チェック',
  checked: 'チェック済',
  adopted: '採用',
  rejected: '却下',
  implemented: '実装済',
  dismissed: 'スキップ',
}

const STATUS_COLORS: Record<SuggestionStatus, string> = {
  new: 'var(--accent2)',
  checked: 'var(--blue)',
  adopted: 'var(--green)',
  rejected: 'var(--text3)',
  implemented: 'var(--accent)',
  dismissed: 'var(--text3)',
}

const ACTIVE_STATUSES: SuggestionStatus[] = ['new', 'checked']

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.5px', minWidth: 52 }}>
        {label}
      </span>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{children}</div>
    </div>
  )
}

function FilterChip({ active, onClick, color, children }: {
  active: boolean
  onClick: () => void
  color?: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 11,
        padding: '3px 10px',
        borderRadius: 12,
        border: `1px solid ${active ? (color || 'var(--accent)') : 'var(--border)'}`,
        background: active ? (color || 'var(--accent)') + '22' : 'var(--surface)',
        color: active ? (color || 'var(--accent)') : 'var(--text2)',
        cursor: 'pointer',
        fontWeight: active ? 600 : 400,
        fontFamily: 'var(--font)',
      }}
    >
      {children}
    </button>
  )
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    const path = u.pathname.length > 1 ? u.pathname : ''
    const combined = `${host}${path}`
    return combined.length > 50 ? combined.substring(0, 50) + '...' : combined
  } catch {
    return url.length > 50 ? url.substring(0, 50) + '...' : url
  }
}

function SuggestionCard({
  suggestion: s,
  busy,
  onCheck,
  onDismiss,
  onAdopt,
  onReject,
  onImplemented,
}: {
  suggestion: IntelligenceSuggestion
  busy: boolean
  onCheck: () => void
  onDismiss: () => void
  onAdopt: () => void
  onReject: () => void
  onImplemented: () => void
}) {
  const reportDate = s.source_report_date
    ? new Date(s.source_report_date).toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' })
    : null

  return (
    <div className="card" style={{ marginBottom: 12, padding: 14, opacity: busy ? 0.6 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
        <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>
          {s.title}
        </div>
        <span style={{
          fontSize: 10, padding: '2px 8px', borderRadius: 10,
          background: STATUS_COLORS[s.status] + '22',
          color: STATUS_COLORS[s.status],
          fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          {STATUS_LABELS[s.status]}
        </span>
      </div>

      {s.description && (
        <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 10 }}>
          {s.description}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        {s.priority && (
          <span style={{
            fontSize: 10, padding: '1px 7px', borderRadius: 3,
            background: PRIORITY_COLORS[s.priority] + '22',
            color: PRIORITY_COLORS[s.priority], fontWeight: 600,
          }}>
            {s.priority}
          </span>
        )}
        {s.effort && (
          <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 3, background: 'var(--surface2)', color: 'var(--text3)' }}>
            effort: {s.effort}
          </span>
        )}
        {s.category && (
          <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 3, background: 'var(--accent-bg, var(--surface2))', color: 'var(--accent2)' }}>
            {s.category}
          </span>
        )}
        {s.target && (
          <span style={{
            fontSize: 10, padding: '1px 7px', borderRadius: 3,
            background: TARGET_COLORS[s.target] + '22',
            color: TARGET_COLORS[s.target],
            fontWeight: 600,
          }}>
            {TARGET_LABELS[s.target]}
          </span>
        )}
        {reportDate && (
          <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{reportDate}</span>
        )}
        {s.task_id !== null && (
          <a
            href={`#/tasks?id=${s.task_id}`}
            style={{ fontSize: 10, color: 'var(--accent)', textDecoration: 'none' }}
            onClick={(e) => { e.preventDefault(); window.location.hash = `#/tasks?id=${s.task_id}` }}
          >
            → タスク #{s.task_id}
          </a>
        )}
      </div>

      {s.source_urls && s.source_urls.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, fontSize: 11 }}>
          {s.source_urls.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
              {shortenUrl(url)} ↗
            </a>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {s.status === 'new' && (
          <>
            <button className="btn btn-g btn-sm" onClick={onDismiss} disabled={busy}>削除</button>
            <button className="btn btn-p btn-sm" onClick={onCheck} disabled={busy}>チェック</button>
          </>
        )}
        {s.status === 'checked' && (
          <>
            <button className="btn btn-g btn-sm" onClick={onReject} disabled={busy}>却下</button>
            <button className="btn btn-p btn-sm" onClick={onAdopt} disabled={busy}>採用</button>
          </>
        )}
        {s.status === 'adopted' && (
          <button className="btn btn-p btn-sm" onClick={onImplemented} disabled={busy}>実装済みにする</button>
        )}
      </div>
    </div>
  )
}

function SuggestionsTab() {
  const [all, setAll] = useState<IntelligenceSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [priorityFilter, setPriorityFilter] = useState<Set<SuggestionPriority>>(new Set())
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<Set<SuggestionStatus>>(new Set())
  const [targetFilter, setTargetFilter] = useState<Set<SuggestionTarget>>(new Set())

  const load = async () => {
    const { data } = await supabase
      .from('intelligence_suggestions')
      .select('*')
      .order('source_report_date', { ascending: false })
    setAll((data as IntelligenceSuggestion[]) || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const s of all) if (s.category) set.add(s.category)
    return Array.from(set).sort()
  }, [all])

  const visible = useMemo(() => {
    return all.filter((s) => {
      if (!showArchived && !ACTIVE_STATUSES.includes(s.status)) return false
      if (priorityFilter.size > 0 && (!s.priority || !priorityFilter.has(s.priority))) return false
      if (categoryFilter.size > 0 && (!s.category || !categoryFilter.has(s.category))) return false
      if (statusFilter.size > 0 && !statusFilter.has(s.status)) return false
      if (targetFilter.size > 0) {
        const t = s.target || 'focus-you'
        const matches = Array.from(targetFilter).some(
          (f) => t === f || t === 'both'
        )
        if (!matches) return false
      }
      return true
    })
  }, [all, showArchived, priorityFilter, categoryFilter, statusFilter, targetFilter])

  const counts = useMemo(() => {
    const c: Record<SuggestionStatus, number> = {
      new: 0, checked: 0, adopted: 0, rejected: 0, implemented: 0, dismissed: 0,
    }
    for (const s of all) c[s.status]++
    return c
  }, [all])

  async function doAction(id: string, action: (id: string) => Promise<unknown>, errorLabel: string) {
    setBusyId(id)
    try {
      await action(id)
      await load()
    } catch (e) {
      console.error(`[SuggestionsTab] ${errorLabel} failed:`, e)
      alert(`${errorLabel}に失敗しました: ${(e as Error).message || e}`)
    } finally {
      setBusyId(null)
    }
  }

  function toggle<T>(set: Set<T>, val: T, setter: (s: Set<T>) => void) {
    const next = new Set(set)
    if (next.has(val)) next.delete(val); else next.add(val)
    setter(next)
  }

  if (loading) return <div className="skeleton-card" style={{ height: 200 }} />
  if (all.length === 0) return <EmptyState icon="💡" message="示唆はまだありません。情報収集部のレポートから自動で収集されます。" />

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, fontSize: 12, flexWrap: 'wrap' }}>
        {(['new', 'checked', 'adopted', 'rejected', 'implemented', 'dismissed'] as const).map((st) => (
          <span key={st} style={{ color: 'var(--text3)' }}>
            <b style={{ color: STATUS_COLORS[st] }}>{counts[st]}</b> {STATUS_LABELS[st]}
          </span>
        ))}
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <FilterGroup label="対象">
          {(['focus-you', 'hd-ops', 'both'] as const).map((t) => (
            <FilterChip key={t} active={targetFilter.has(t)} onClick={() => toggle(targetFilter, t, setTargetFilter)} color={TARGET_COLORS[t]}>{TARGET_LABELS[t]}</FilterChip>
          ))}
        </FilterGroup>
        <FilterGroup label="優先度">
          {(['high', 'medium', 'low'] as const).map((p) => (
            <FilterChip key={p} active={priorityFilter.has(p)} onClick={() => toggle(priorityFilter, p, setPriorityFilter)} color={PRIORITY_COLORS[p]}>{p}</FilterChip>
          ))}
        </FilterGroup>
        {categories.length > 0 && (
          <FilterGroup label="カテゴリ">
            {categories.map((c) => (
              <FilterChip key={c} active={categoryFilter.has(c)} onClick={() => toggle(categoryFilter, c, setCategoryFilter)}>{c}</FilterChip>
            ))}
          </FilterGroup>
        )}
        <FilterGroup label="状態">
          {(['new', 'checked', 'adopted', 'rejected', 'implemented', 'dismissed'] as const).map((s) => (
            <FilterChip key={s} active={statusFilter.has(s)} onClick={() => toggle(statusFilter, s, setStatusFilter)} color={STATUS_COLORS[s]}>{STATUS_LABELS[s]}</FilterChip>
          ))}
        </FilterGroup>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{visible.length} / {all.length} 件</span>
          <label style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            完了・却下・スキップも表示
          </label>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon="🔍" message="条件に合う示唆がありません" />
      ) : (
        visible.map((s) => (
          <SuggestionCard
            key={s.id}
            suggestion={s}
            busy={busyId === s.id}
            onCheck={() => doAction(s.id, checkSuggestion, 'チェック')}
            onDismiss={() => doAction(s.id, dismissSuggestion, '削除')}
            onAdopt={() => doAction(s.id, adoptSuggestion, '採用')}
            onReject={() => doAction(s.id, rejectSuggestion, '却下')}
            onImplemented={() => doAction(s.id, markImplemented, '実装済み')}
          />
        ))
      )}
    </div>
  )
}

// ============================================================

type Tab = 'research' | 'news' | 'interests' | 'suggestions' | 'sources'

export function Reports() {
  const initialTab = window.location.hash === '#sources' ? 'sources' : 'research'
  const [tab, setTab] = useState<Tab>(initialTab)

  return (
    <div className="page">
      <PageHeader title="News" description="調査レポート・ニュース・示唆" />

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--border)', paddingBottom: 0 }}>
        {([['research', 'レポート'], ['news', 'ニュース'], ['interests', '気になった'], ['suggestions', 'Suggestions'], ['sources', 'ソース']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              background: 'none', border: 'none', padding: '10px 16px', fontSize: 13,
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

      {tab === 'research' ? <ResearchReports /> : tab === 'news' ? <NewsFeed /> : tab === 'interests' ? <InterestArticles /> : tab === 'suggestions' ? <SuggestionsTab /> : <SourceSettings />}
    </div>
  )
}

/**
 * Safely render markdown into a DOM ref.
 * Uses marked for parsing, then DOM-based sanitization (strip scripts, on* handlers, dangerous hrefs).
 * Note: innerHTML is used intentionally after sanitization — content is from our own DB (artifacts table).
 */
function SafeMarkdown({
  content,
  trackingContext,
}: {
  content: string
  trackingContext?: { artifactId: number; title: string; tags: string[] }
}) {
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

  useEffect(() => {
    if (!ref.current || !trackingContext) return
    const ctx = trackingContext
    const node = ref.current
    const handler = (e: Event) => {
      const target = (e.target as HTMLElement)?.closest('a') as HTMLAnchorElement | null
      if (!target) return
      const url = target.getAttribute('href') || ''
      if (!url || url.startsWith('#')) return
      supabase.from('activity_log').insert({
        action: 'intelligence_click',
        metadata: {
          artifact_id: ctx.artifactId,
          title: ctx.title,
          url,
          link_text: (target.textContent || '').slice(0, 200),
          category: inferCategoryFromUrl(url),
          tags: ctx.tags,
        },
      })
    }
    node.addEventListener('click', handler)
    return () => node.removeEventListener('click', handler)
  }, [trackingContext])

  return <div ref={ref} className="md-body" style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text2)' }} />
}

function inferCategoryFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (host.includes('arxiv.org') || host.includes('openreview.net')) return 'paper'
    if (host.includes('anthropic.com') || host.includes('claude.com')) return 'anthropic'
    if (host.includes('openai.com')) return 'openai'
    if (host.includes('deepmind.google') || host.includes('blog.google')) return 'google'
    if (host.includes('ai.meta.com')) return 'meta'
    if (host.includes('x.com') || host.includes('twitter.com')) return 'x_post'
    if (host.includes('github.com')) return 'github'
    return host
  } catch {
    return 'unknown'
  }
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
            <SafeMarkdown
              content={r.content}
              trackingContext={{ artifactId: r.id, title: r.title, tags: r.tags }}
            />
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
                          onClick={(e) => {
                            e.stopPropagation()
                            supabase.from('activity_log').insert({
                              action: 'intelligence_click',
                              metadata: {
                                news_item_id: item.id,
                                title: item.title_ja || item.title,
                                url: item.url,
                                source: item.source,
                                topic: item.topic,
                                category: inferCategoryFromUrl(item.url || ''),
                              },
                            })
                          }}
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
// Interest Articles
// ============================================================

interface InterestArticle {
  id: string
  url: string
  title: string | null
  notes: string | null
  tags: string[]
  source_domain: string | null
  created_at: string
  analyzed: boolean
  gap_reason: string | null
  gap_type: string | null
  added_to_sources: boolean
}

function GapBadge({ article }: { article: InterestArticle }) {
  if (!article.analyzed) {
    return (
      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--surface2)', color: 'var(--text3)' }}>
        未分析
      </span>
    )
  }
  if (article.gap_type === 'already_covered') {
    return (
      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--green-bg, #e6f4ea)', color: 'var(--green)' }}>
        収集済み
      </span>
    )
  }
  if (article.gap_type === 'missing_domain') {
    if (article.added_to_sources) {
      return (
        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--accent-bg)', color: 'var(--accent)' }}>
          ソース追加済み
        </span>
      )
    }
    return (
      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--red-bg)', color: 'var(--red)' }}>
        ドメイン未登録
      </span>
    )
  }
  if (article.gap_type === 'missing_keyword') {
    return (
      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#fff3e0', color: '#e65100' }}>
        キーワード追加
      </span>
    )
  }
  if (article.gap_type === 'missing_x_account') {
    return (
      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--surface2)', color: 'var(--text3)' }}>
        Xアカウント未登録
      </span>
    )
  }
  return null
}

function InterestArticles() {
  const [articles, setArticles] = useState<InterestArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('interest_articles')
        .select('*')
        .order('created_at', { ascending: false })
      setArticles((data as InterestArticle[]) || [])
    } catch {
      setArticles([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    if (!url.trim()) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = await supabase
        .from('interest_articles')
        .insert({
          url: url.trim(),
          title: title.trim() || null,
          notes: notes.trim() || null,
          user_id: user?.id ?? null,
        })
        .select()
        .single()
      if (data) {
        setArticles((prev) => [data as InterestArticle, ...prev])
        supabase.from('activity_log').insert({
          action: 'interest_article_added',
          metadata: { url: url.trim(), title: title.trim() || null },
        })
        setUrl('')
        setTitle('')
        setNotes('')
      }
    } catch (e) {
      console.error('[InterestArticles] save error:', e)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await supabase.from('interest_articles').delete().eq('id', id)
    setArticles((prev) => prev.filter((a) => a.id !== id))
  }

  if (loading) return <SkeletonRows count={4} />

  return (
    <div>
      {/* 登録フォーム */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            className="input"
            placeholder="URL（必須）"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <input
            className="input"
            placeholder="タイトル（任意）"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="input"
            placeholder="メモ（任意）"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ minHeight: 60, resize: 'vertical' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-p btn-sm"
              onClick={handleSave}
              disabled={!url.trim() || saving}
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>

      {/* 記事一覧 */}
      {articles.length === 0 ? (
        <EmptyState icon="🔖" message="気になった記事を登録すると、情報収集部が自動的に学習します" />
      ) : (
        <div>
          {articles.map((a) => (
            <div key={a.id} className="card" style={{ marginBottom: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                    {a.title || a.source_domain || a.url}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                      {a.url}
                    </a>
                  </div>
                  {a.notes && (
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6, lineHeight: 1.5 }}>
                      {a.notes}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                    <GapBadge article={a} />
                    {a.gap_reason && (
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>{a.gap_reason}</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                    {new Date(a.created_at).toLocaleDateString('ja-JP')}
                  </span>
                  <button
                    onClick={() => handleDelete(a.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text3)', padding: '2px 4px' }}
                    title="削除"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          ))}
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
