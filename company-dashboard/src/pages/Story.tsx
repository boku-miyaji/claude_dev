import { useEffect, useMemo } from 'react'
import { Card, PageHeader } from '@/components/ui'
import { useDataStore } from '@/stores/data'
import { useArcReader } from '@/hooks/useArcReader'
import { useThemeFinder } from '@/hooks/useThemeFinder'
import { useForesight } from '@/hooks/useForesight'
import type { ArcPhase } from '@/types/narrator'

const PHASE_META: Record<ArcPhase, { label: string; icon: string; color: string; description: string }> = {
  exploration: { label: '探索', icon: '🔍', color: 'var(--accent)', description: '新しいことを探っている時期' },
  immersion: { label: '没頭', icon: '🌊', color: 'var(--blue)', description: '何かに深く入り込んでいる時期' },
  reflection: { label: '内省', icon: '🪞', color: 'var(--green)', description: '立ち止まって自分を見つめている時期' },
  reconstruction: { label: '再構築', icon: '🔄', color: 'var(--amber)', description: '価値観や方向性を再定義している時期' },
  leap: { label: '飛躍', icon: '🚀', color: 'var(--red)', description: '突破と成長の時期' },
}

export function Story() {
  const { emotionAnalyses, fetchEmotions, loading } = useDataStore()
  const { arc, loading: arcLoading } = useArcReader()
  const { theme, loading: themeLoading, unlocked } = useThemeFinder()
  const { foresight } = useForesight()

  useEffect(() => {
    fetchEmotions({ days: 90 })
  }, [fetchEmotions])

  // WBI time series for chart
  const wbiTimeline = useMemo(() => {
    if (emotionAnalyses.length === 0) return []
    const sorted = [...emotionAnalyses].sort((a, b) => a.created_at.localeCompare(b.created_at))
    return sorted.map((e) => ({
      date: e.created_at.substring(0, 10),
      wbi: e.wbi_score,
      valence: e.valence,
    }))
  }, [emotionAnalyses])

  // Simple sparkline renderer
  const renderSparkline = (data: number[], color: string, height = 48) => {
    if (data.length < 2) return null
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    const w = 100
    const points = data.map((v, i) => {
      const x = (i / (data.length - 1)) * w
      const y = height - ((v - min) / range) * (height - 4) - 2
      return `${x},${y}`
    }).join(' ')
    return (
      <svg viewBox={`0 0 ${w} ${height}`} style={{ width: '100%', height }} preserveAspectRatio="none">
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  const isLoading = loading.emotions || arcLoading || themeLoading

  return (
    <div className="page">
      <PageHeader title="Story" description="日記から見える自分の流れ" />

      {/* Current Arc */}
      {arc && (() => {
        const phase = arc.phase as ArcPhase
        const meta = PHASE_META[phase] || PHASE_META.exploration
        return (
          <div className="section">
            <div className="section-title">今の章</div>
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 24 }}>{meta.icon}</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: meta.color }}>
                    {meta.label}のフェーズ
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {meta.description}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, paddingLeft: 12, borderLeft: `2px solid ${meta.color}` }}>
                {arc.narrative}
              </div>
            </Card>
          </div>
        )
      })()}

      {/* Foresight */}
      {foresight && (
        <div className="section">
          <div className="section-title">予感</div>
          <Card>
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 6 }}>
              {foresight.insight}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)' }}>
              {foresight.basis}
            </div>
          </Card>
        </div>
      )}

      {/* Theme / Identity */}
      {theme && (
        <div className="section">
          <div className="section-title">あなたのテーマ</div>
          <Card>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8, letterSpacing: '-0.02em' }}>
              {theme.identity}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 16 }}>
              {theme.aspirations}
            </div>

            {/* Emotional DNA */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                  喜びのトリガー
                </div>
                {theme.emotionalDNA.joyTriggers.map((t: string, i: number) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 2 }}>
                    {t}
                  </div>
                ))}
              </div>
              <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                  エネルギー源
                </div>
                {theme.emotionalDNA.energySources.map((s: string, i: number) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 2 }}>
                    {s}
                  </div>
                ))}
              </div>
              <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                  回復スタイル
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                  {theme.emotionalDNA.recoveryStyle}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {!unlocked && !themeLoading && (
        <div className="section">
          <div className="section-title">あなたのテーマ</div>
          <Card style={{ textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>🔒</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>日記を30件以上書くとアンロック</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>あなたの通底テーマとEmotional DNAが見えてきます</div>
          </Card>
        </div>
      )}

      {/* Emotion Arc (WBI Timeline) */}
      {wbiTimeline.length > 2 && (
        <div className="section">
          <div className="section-title">感情の軌跡（WBI）</div>
          <Card>
            <div style={{ marginBottom: 8 }}>
              {renderSparkline(wbiTimeline.map((d) => d.wbi), 'var(--accent)', 64)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
              <span>{wbiTimeline[0].date}</span>
              <span>{wbiTimeline[wbiTimeline.length - 1].date}</span>
            </div>
          </Card>
        </div>
      )}

      {/* Valence Timeline */}
      {wbiTimeline.length > 2 && (
        <div className="section">
          <div className="section-title">感情価の推移</div>
          <Card>
            <div style={{ marginBottom: 8 }}>
              {renderSparkline(wbiTimeline.map((d) => d.valence), 'var(--green)', 48)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)' }}>
              <span>ネガティブ ←</span>
              <span>→ ポジティブ</span>
            </div>
          </Card>
        </div>
      )}

      {isLoading && wbiTimeline.length === 0 && !arc && (
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ color: 'var(--text3)' }}>Loading...</div>
        </Card>
      )}
    </div>
  )
}
