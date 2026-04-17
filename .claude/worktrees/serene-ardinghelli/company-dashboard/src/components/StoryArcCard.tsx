import { useArcReader } from '@/hooks/useArcReader'

/**
 * Compact card showing recent change insight from Arc Reader.
 * Sits below the AI briefing on the Today page.
 * Shows fact-based narrative, no abstract phase labels.
 */
export function StoryArcCard() {
  const { arc, loading } = useArcReader()

  if (loading || !arc) return null

  return (
    <div style={{
      padding: '10px 14px',
      background: 'var(--surface2)',
      borderRadius: 8,
      borderLeft: '2px solid var(--border)',
      marginTop: 8,
    }}>
      <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
        {arc.narrative}
      </div>
    </div>
  )
}
