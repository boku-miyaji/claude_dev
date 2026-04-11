import { useArcReader } from '@/hooks/useArcReader'
import type { ArcPhase } from '@/types/narrator'

const PHASE_META: Record<ArcPhase, { label: string; icon: string; color: string }> = {
  exploration: { label: '探索', icon: '🔍', color: 'var(--accent)' },
  immersion: { label: '没頭', icon: '🌊', color: 'var(--blue)' },
  reflection: { label: '内省', icon: '🪞', color: 'var(--green)' },
  reconstruction: { label: '再構築', icon: '🔄', color: 'var(--amber)' },
  leap: { label: '飛躍', icon: '🚀', color: 'var(--red)' },
}

/**
 * Compact card showing the current story arc phase.
 * Designed to sit below the AI briefing on the Today page.
 */
export function StoryArcCard() {
  const { arc, loading } = useArcReader()

  if (loading || !arc) return null

  const meta = PHASE_META[arc.phase] || PHASE_META.exploration

  return (
    <div style={{
      padding: '10px 14px',
      background: 'var(--surface2)',
      borderRadius: 8,
      borderLeft: `3px solid ${meta.color}`,
      marginTop: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 12 }}>{meta.icon}</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {meta.label}のフェーズ
        </span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
        {arc.narrative}
      </div>
    </div>
  )
}
