import { useState } from 'react'
import { Card, PageHeader } from '@/components/ui'
import { useWeeklyNarrative } from '@/hooks/useWeeklyNarrative'

const EMOTION_LABELS: Record<string, string> = {
  joy: 'Joy',
  trust: 'Trust',
  fear: 'Fear',
  surprise: 'Surprise',
  sadness: 'Sadness',
  disgust: 'Disgust',
  anger: 'Anger',
  anticipation: 'Anticipation',
}

export function WeeklyNarrative() {
  const { weeks, loading, generating, error, generate } = useWeeklyNarrative()
  const [selectedIdx, setSelectedIdx] = useState(0)

  if (loading) {
    return (
      <div className="page">
        <PageHeader title="Weekly Story" />
        <div style={{ color: 'var(--text3)' }}>Loading...</div>
      </div>
    )
  }

  const selected = weeks[selectedIdx]

  return (
    <div className="page">
      <PageHeader title="Weekly Story" description="あなたの1週間を振り返ります" />

      {/* Week selector tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, overflowX: 'auto', paddingBottom: 4 }}>
        {weeks.map((w, i) => (
          <button
            key={w.weekStart}
            className={`btn ${i === selectedIdx ? 'btn-p' : 'btn-g'} btn-sm`}
            onClick={() => setSelectedIdx(i)}
            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {w.label}
          </button>
        ))}
      </div>

      {selected && (
        <>
          {/* Week header */}
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
            <span style={{ fontWeight: 600 }}>Week {selected.weekNumber}</span>
            <span style={{ color: 'var(--text3)', marginLeft: 8 }}>
              {selected.weekStart} - {selected.weekEnd}
            </span>
          </div>

          {/* Stats summary */}
          {selected.narrative && selected.narrative.stats && (
            <div className="section">
              <div className="section-title">サマリー</div>
              <Card>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  {selected.narrative.stats.diary_count !== undefined && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent2)' }}>
                        {selected.narrative.stats.diary_count}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>日記</div>
                    </div>
                  )}
                  {selected.narrative.stats.task_count !== undefined && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--green)' }}>
                        {selected.narrative.stats.task_count}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>完了タスク</div>
                    </div>
                  )}
                  {selected.narrative.stats.avg_wbi !== undefined && selected.narrative.stats.avg_wbi > 0 && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--amber)' }}>
                        {selected.narrative.stats.avg_wbi}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>WBI平均</div>
                    </div>
                  )}
                  {selected.narrative.stats.dominant_emotion && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--blue)' }}>
                        {EMOTION_LABELS[selected.narrative.stats.dominant_emotion] ?? selected.narrative.stats.dominant_emotion}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>感情傾向</div>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* Narrative */}
          {selected.narrative ? (
            <div className="section">
              <div className="section-title">ナラティブ</div>
              <Card>
                <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                  {selected.narrative.narrative}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 12, fontFamily: 'var(--mono)' }}>
                  生成日: {new Date(selected.narrative.created_at).toLocaleDateString('ja-JP')}
                </div>
              </Card>
            </div>
          ) : (
            <div className="section">
              <Card>
                <div style={{ textAlign: 'center', padding: 24 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>
                    この週のナラティブはまだ生成されていません
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
                    AIがあなたの1週間を振り返ります
                  </div>
                  <button
                    className="btn btn-p btn-sm"
                    disabled={generating}
                    onClick={() => generate(selected.weekStart, selected.weekEnd)}
                  >
                    {generating ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          display: 'inline-block',
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          border: '2px solid currentColor',
                          borderTopColor: 'transparent',
                          animation: 'spin 1s linear infinite',
                        }} />
                        生成中...
                      </span>
                    ) : 'レポートを生成'}
                  </button>
                </div>
              </Card>
            </div>
          )}

          {/* Error display */}
          {error && (
            <div style={{ fontSize: 12, color: 'var(--red)', padding: '8px 12px', background: 'var(--surface2)', borderRadius: 8, marginTop: 12 }}>
              {error}
            </div>
          )}
        </>
      )}
    </div>
  )
}
