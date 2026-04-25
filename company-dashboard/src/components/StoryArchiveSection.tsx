import { useEffect, useState } from 'react'
import { Card } from '@/components/ui'
import { fetchStoryMemoryArchive } from '@/lib/storyMemoryArchive'

interface ArchiveRow {
  id: number
  memory_type: string
  narrative_text: string | null
  version: number
  archived_at: string
  archive_reason: string | null
  original_updated_at: string
}

type Filter = 'all' | 'current_arc' | 'theme' | 'chapter'

const TYPE_LABEL: Record<string, { label: string; color: string }> = {
  current_arc: { label: 'Arc', color: 'var(--accent)' },
  theme: { label: 'Theme', color: 'var(--amber)' },
  chapter: { label: 'Chapter', color: 'var(--blue)' },
}

/**
 * Past Arc / Theme / Chapter の履歴閲覧セクション。
 * 折りたたみで普段は目立たせない。能動的に振り返りたい時だけ開く静かな記念館。
 */
export function StoryArchiveSection() {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [rows, setRows] = useState<ArchiveRow[]>([])
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    if (!open || loaded) return
    let cancelled = false
    Promise.all([
      fetchStoryMemoryArchive('current_arc', 30),
      fetchStoryMemoryArchive('theme', 30),
      fetchStoryMemoryArchive('chapter', 30),
    ]).then(([arcs, themes, chapters]) => {
      if (cancelled) return
      const merged = ([...arcs, ...themes, ...chapters] as ArchiveRow[])
        .filter((r) => r.narrative_text && r.narrative_text.trim().length > 0)
        .sort((a, b) => new Date(b.archived_at).getTime() - new Date(a.archived_at).getTime())
      setRows(merged)
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [open, loaded])

  const filtered = filter === 'all' ? rows : rows.filter((r) => r.memory_type === filter)

  return (
    <div className="section" style={{ marginTop: 24 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '14px 18px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r2)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: 'var(--font)',
          color: 'var(--text)',
        }}
      >
        <div>
          <span style={{ fontSize: 13, fontWeight: 600 }}>🕰 過去のアーク・テーマを振り返る</span>
          {loaded && (
            <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 10 }}>
              {rows.length} 件の履歴
            </span>
          )}
        </div>
        <span style={{ fontSize: 14, color: 'var(--text3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
      </button>

      {open && (
        <Card style={{ marginTop: 8, padding: '14px 18px' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {([
              { v: 'all', label: 'すべて' },
              { v: 'current_arc', label: 'Arc のみ' },
              { v: 'theme', label: 'Theme のみ' },
              { v: 'chapter', label: 'Chapter のみ' },
            ] as const).map((opt) => (
              <button
                key={opt.v}
                onClick={() => setFilter(opt.v)}
                style={{
                  fontSize: 11,
                  padding: '4px 12px',
                  borderRadius: 14,
                  border: `1px solid ${filter === opt.v ? 'var(--accent-border)' : 'var(--border)'}`,
                  background: filter === opt.v ? 'var(--accent-bg)' : 'transparent',
                  color: filter === opt.v ? 'var(--accent)' : 'var(--text3)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font)',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {!loaded && <div style={{ fontSize: 12, color: 'var(--text3)' }}>Loading…</div>}
          {loaded && filtered.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              この種別の過去履歴はまだありません。
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((r) => {
              const meta = TYPE_LABEL[r.memory_type] ?? { label: r.memory_type, color: 'var(--text3)' }
              return (
                <div
                  key={r.id}
                  style={{
                    padding: '12px 14px',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderLeft: `3px solid ${meta.color}`,
                    borderRadius: 'var(--r)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: 9,
                        fontFamily: 'var(--mono)',
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: 2,
                        background: 'var(--surface2)',
                        color: meta.color,
                      }}
                    >
                      {meta.label}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                      {new Date(r.original_updated_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' })}
                      {r.archive_reason ? ` · ${r.archive_reason}` : ''}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {r.narrative_text}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
