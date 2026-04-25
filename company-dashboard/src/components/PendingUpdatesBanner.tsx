import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

interface PendingSummary {
  total: number
  bySource: Record<string, number>
}

const SOURCE_LABELS: Record<string, { label: string; href: string }> = {
  manual_seed: { label: '取扱説明書', href: '/manual' },
  roots_digest: { label: 'Roots', href: '/roots' },
  weekly_narrative: { label: '週間ナラティブ', href: '/weekly' },
  self_analysis: { label: '自己分析', href: '/me' },
  arc_reader: { label: 'Story (Arc)', href: '/story' },
  theme_finder: { label: 'Story (Theme)', href: '/story' },
  chapter: { label: 'Story (Chapter)', href: '/story' },
  dream_detection: { label: '夢の気づき', href: '/dreams' },
}

/**
 * Banner shown at the top of Today when AI has generated update proposals
 * that are waiting for the user's approval. Clicking an item jumps to the
 * page where the proposal can be reviewed.
 */
export function PendingUpdatesBanner() {
  const [summary, setSummary] = useState<PendingSummary>({ total: 0, bySource: {} })

  useEffect(() => {
    supabase
      .from('pending_updates')
      .select('source')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        const rows = (data ?? []) as Array<{ source: string }>
        const bySource: Record<string, number> = {}
        for (const r of rows) {
          bySource[r.source] = (bySource[r.source] ?? 0) + 1
        }
        setSummary({ total: rows.length, bySource })
      })
  }, [])

  if (summary.total === 0) return null

  const entries = Object.entries(summary.bySource).sort((a, b) => b[1] - a[1])

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        padding: '10px 14px', marginBottom: 16,
        background: 'rgba(75, 120, 98, 0.08)',
        border: '1px solid rgba(75, 120, 98, 0.25)',
        borderRadius: 8,
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>
        🤖 AI からの更新候補が {summary.total} 件あります
      </span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {entries.map(([source, count]) => {
          const meta = SOURCE_LABELS[source] ?? { label: source, href: '/' }
          return (
            <Link
              key={source}
              to={meta.href}
              style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 12,
                background: 'var(--surface)', color: 'var(--text2)',
                textDecoration: 'none', border: '1px solid var(--border)',
              }}
            >
              {meta.label} {count}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
