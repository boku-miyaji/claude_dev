import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, PageHeader } from '@/components/ui'
import { useSelfAnalysis, type AnalysisType, type AnalysisRecord } from '@/hooks/useSelfAnalysis'
import { useDataStore } from '@/stores/data'

type TabType = 'mbti' | 'big5' | 'strengths_finder' | 'values'

const ALL_TYPES: TabType[] = ['mbti', 'big5', 'strengths_finder', 'values']

const TAB_META: Record<TabType, { label: string; title: string }> = {
  mbti: { label: 'MBTI', title: 'MBTI' },
  big5: { label: 'Big5', title: 'Big5' },
  strengths_finder: { label: 'SF', title: 'StrengthsFinder' },
  values: { label: 'Values', title: 'Values' },
}

// ---------------------------------------------------------------------------
// SVG Pentagon Radar Chart for Big5
// ---------------------------------------------------------------------------

interface PentagonRadarProps {
  scores: number[] // [openness, conscientiousness, extraversion, agreeableness, neuroticism]
  labels: string[]
  size?: number
}

function PentagonRadar({ scores, labels, size = 300 }: PentagonRadarProps) {
  const cx = size / 2
  const cy = size / 2
  const maxR = size * 0.4 // 120 for size=300

  function getPoint(index: number, radius: number): [number, number] {
    const angle = (index * 2 * Math.PI) / 5 - Math.PI / 2
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]
  }

  function polygonPoints(radius: number): string {
    return Array.from({ length: 5 }, (_, i) => getPoint(i, radius).join(',')).join(' ')
  }

  function dataPolygonPoints(): string {
    return scores.map((s, i) => {
      const r = (s / 100) * maxR
      return getPoint(i, r).join(',')
    }).join(' ')
  }

  const gridLayers = [0.25, 0.5, 0.75]

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ display: 'block', margin: '0 auto' }}>
      {/* Grid lines */}
      {gridLayers.map((scale) => (
        <polygon
          key={scale}
          points={polygonPoints(maxR * scale)}
          fill="none"
          stroke="var(--surface2)"
          strokeWidth={1}
        />
      ))}
      {/* Outer pentagon */}
      <polygon
        points={polygonPoints(maxR)}
        fill="none"
        stroke="var(--surface2)"
        strokeWidth={1}
      />
      {/* Axis lines */}
      {Array.from({ length: 5 }, (_, i) => {
        const [x, y] = getPoint(i, maxR)
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--surface2)" strokeWidth={0.5} />
      })}
      {/* Data polygon */}
      <polygon
        points={dataPolygonPoints()}
        fill="rgba(99,102,241,0.15)"
        stroke="var(--accent)"
        strokeWidth={2}
      />
      {/* Data dots */}
      {scores.map((s, i) => {
        const r = (s / 100) * maxR
        const [x, y] = getPoint(i, r)
        return <circle key={i} cx={x} cy={y} r={4} fill="var(--accent)" />
      })}
      {/* Labels */}
      {labels.map((label, i) => {
        const [x, y] = getPoint(i, maxR + 24)
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="var(--text2)"
            fontSize={11}
            fontWeight={500}
          >
            {label} {scores[i]}
          </text>
        )
      })}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Shared: Changes badge
// ---------------------------------------------------------------------------
function ChangesFromPrevious({ result }: { result: Record<string, unknown> }) {
  const changes = result.changes_from_previous as string | undefined
  if (!changes) return null
  return (
    <div style={{
      marginTop: 16, padding: '12px 16px',
      background: 'rgba(91,141,239,0.08)', borderRadius: 8,
      borderLeft: '3px solid var(--accent)',
    }}>
      <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
        前回からの変化
      </div>
      <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>{changes}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helper: Structured description sections
// ---------------------------------------------------------------------------
function FormattedDescription({ text }: { text: string }) {
  const sections = text.split(/(?=【)/).filter(Boolean)
  if (sections.length <= 1) {
    return (
      <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.8 }}>
        {text.split('\n').filter(Boolean).map((p, i) => <p key={i} style={{ marginBottom: 8 }}>{p}</p>)}
      </div>
    )
  }

  function getSectionStyle(header: string): React.CSSProperties {
    if (header.includes('活かし方')) {
      return { padding: '12px 16px', background: 'var(--surface2)', borderRadius: 8, borderLeft: '3px solid var(--green)' }
    }
    if (header.includes('注意点')) {
      return { padding: '12px 16px', background: 'var(--surface2)', borderRadius: 8, borderLeft: '3px solid var(--amber)' }
    }
    return { padding: '12px 16px', background: 'var(--surface2)', borderRadius: 8 }
  }

  function getHeaderColor(header: string): string {
    if (header.includes('活かし方')) return 'var(--green)'
    if (header.includes('注意点')) return 'var(--amber)'
    return 'var(--accent2)'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {sections.map((sec, i) => {
        const headerMatch = sec.match(/^【(.+?)】\s*/)
        if (!headerMatch) {
          return <p key={i} style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.8, marginBottom: 4 }}>{sec.trim()}</p>
        }
        const header = headerMatch[1]
        const body = sec.slice(headerMatch[0].length).trim()
        const lines = body.split('\n').filter(Boolean)
        return (
          <div key={i} style={getSectionStyle(header)}>
            <div style={{ fontSize: 12, fontWeight: 600, color: getHeaderColor(header), marginBottom: 8 }}>{header}</div>
            {lines.map((line, j) => {
              const numMatch = line.match(/^(\d+)[.)]\s*(.+)/)
              if (numMatch) {
                return (
                  <div key={j} style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7, paddingLeft: 4, marginBottom: 4, display: 'flex', gap: 8 }}>
                    <span style={{ color: getHeaderColor(header), fontWeight: 600, minWidth: 16 }}>{numMatch[1]}.</span>
                    <span>{numMatch[2]}</span>
                  </div>
                )
              }
              return <div key={j} style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 2 }}>{line}</div>
            })}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Evidence display
// ---------------------------------------------------------------------------
function EvidenceList({ evidence }: { evidence: string[] }) {
  if (!evidence || evidence.length === 0) return null
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>
        根拠
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {evidence.map((e, i) => {
          const dateMatch = e.match(/^\[([^\]]+)\]\s*(.*)$/)
          return (
            <div key={i} style={{
              padding: '8px 12px', background: 'var(--surface2)', borderRadius: 6,
              fontSize: 12, color: 'var(--text3)', lineHeight: 1.6, fontStyle: 'italic',
            }}>
              {dateMatch ? (
                <>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', fontStyle: 'normal', marginRight: 8 }}>{dateMatch[1]}</span>
                  {dateMatch[2]}
                </>
              ) : e}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dashboard Cards (compact summaries for 2x2 grid)
// ---------------------------------------------------------------------------

function MbtiDashCard({ result }: { result: Record<string, unknown> }) {
  const dims = result.dimensions as Record<string, { score: number; label: string }> | undefined
  const typeName = result.type_name as string | undefined
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent2)', fontFamily: 'var(--mono)', letterSpacing: 4 }}>
          {String(result.type)}
        </div>
        {typeName && <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>{typeName}</div>}
      </div>
      {dims && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {Object.entries(dims).map(([key, val]) => {
            const labels = key.split('_')
            const pct = ((val.score + 100) / 200) * 100
            return (
              <div key={key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>
                  <span>{labels[0]}</span><span>{labels[1]}</span>
                </div>
                <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
                  <div style={{
                    position: 'absolute',
                    left: `${Math.min(pct, 50)}%`,
                    width: `${Math.abs(pct - 50)}%`,
                    height: '100%',
                    background: 'var(--accent)',
                    borderRadius: 2,
                  }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Big5DashCard({ result }: { result: Record<string, unknown> }) {
  const traits = [
    { key: 'openness', label: '開放性' },
    { key: 'conscientiousness', label: '誠実性' },
    { key: 'extraversion', label: '外向性' },
    { key: 'agreeableness', label: '協調性' },
    { key: 'neuroticism', label: '神経症傾向' },
  ]
  const scores = traits.map(t => (result[t.key] as number) ?? 0)
  const labels = traits.map(t => t.label)
  return <PentagonRadar scores={scores} labels={labels} size={200} />
}

function SfDashCard({ result }: { result: Record<string, unknown> }) {
  const strengths = (result.top_strengths as { name: string; score: number; domain: string }[]) ?? []
  const domainSummary = result.domain_summary as Record<string, { score: number; label: string }> | undefined
  const domainColors: Record<string, string> = {
    strategic_thinking: 'var(--accent)',
    relationship_building: 'var(--green)',
    influencing: 'var(--amber)',
    executing: 'var(--red)',
  }
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 8 }}>Top 5</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
        {strengths.slice(0, 5).map((s, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text2)' }}>
            <span>{i + 1}. {s.name}</span>
            <span style={{ fontFamily: 'var(--mono)', color: 'var(--accent2)', fontWeight: 600, fontSize: 11 }}>{s.score}</span>
          </div>
        ))}
      </div>
      {domainSummary && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {Object.entries(domainSummary).map(([key, val]) => (
            <div key={key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>
                <span>{val.label}</span><span>{val.score}</span>
              </div>
              <div style={{ height: 3, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${val.score}%`, background: domainColors[key] ?? 'var(--accent)', borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ValuesDashCard({ result }: { result: Record<string, unknown> }) {
  const values = (result.values as { name: string; rank: number; score: number }[]) ?? []
  const amberShades = ['var(--amber)', 'rgba(245,158,11,0.8)', 'rgba(245,158,11,0.6)', 'rgba(245,158,11,0.45)', 'rgba(245,158,11,0.3)']
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {values.slice(0, 5).map((v, i) => (
        <div key={v.rank}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text2)', marginBottom: 2 }}>
            <span>#{v.rank} {v.name}</span>
            <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 10 }}>{v.score}</span>
          </div>
          <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${v.score}%`, background: amberShades[i] ?? 'var(--amber)', borderRadius: 2 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Detail Tab: MBTI
// ---------------------------------------------------------------------------
function MbtiDetail({ result }: { result: Record<string, unknown> }) {
  const dims = result.dimensions as Record<string, { score: number; label: string }> | undefined
  const typeName = result.type_name as string | undefined
  const evidence = (result.evidence as string[]) ?? []

  const dimLabels: Record<string, [string, string]> = {
    E_I: ['外向的 (E)', '内向的 (I)'],
    S_N: ['感覚的 (S)', '直観的 (N)'],
    T_F: ['思考型 (T)', '感情型 (F)'],
    J_P: ['判断型 (J)', '知覚型 (P)'],
  }

  return (
    <div>
      {/* Type display */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 48, fontWeight: 700, color: 'var(--accent2)', fontFamily: 'var(--mono)', letterSpacing: 6 }}>
          {String(result.type)}
        </div>
        {typeName && <div style={{ fontSize: 16, color: 'var(--text2)', marginTop: 4 }}>{typeName}</div>}
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
          確信度: {String(result.confidence)}
        </div>
      </div>

      {/* Bidirectional bars */}
      {dims && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
          {Object.entries(dims).map(([key, val]) => {
            const [leftLabel, rightLabel] = dimLabels[key] ?? key.split('_')
            const pct = ((val.score + 100) / 200) * 100
            return (
              <div key={key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                  <span style={{ color: 'var(--text2)', fontWeight: 500 }}>{leftLabel}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>{val.score > 0 ? '+' : ''}{val.score}</span>
                  <span style={{ color: 'var(--text2)', fontWeight: 500 }}>{rightLabel}</span>
                </div>
                <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                  {/* Center marker */}
                  <div style={{ position: 'absolute', left: '50%', top: 0, width: 1, height: '100%', background: 'var(--text3)', opacity: 0.4, zIndex: 1 }} />
                  <div style={{
                    position: 'absolute',
                    left: `${Math.min(pct, 50)}%`,
                    width: `${Math.abs(pct - 50)}%`,
                    height: '100%',
                    background: 'var(--accent)',
                    borderRadius: 4,
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text3)', marginTop: 2, opacity: 0.6 }}>
                  <span>-100</span><span>0</span><span>+100</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Structured description */}
      {Boolean(result.description) && <FormattedDescription text={String(result.description)} />}

      {/* Evidence */}
      <EvidenceList evidence={evidence} />

      {/* Changes */}
      <ChangesFromPrevious result={result} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Detail Tab: Big5
// ---------------------------------------------------------------------------
function Big5Detail({ result }: { result: Record<string, unknown> }) {
  const traits = [
    { key: 'openness', label: '開放性' },
    { key: 'conscientiousness', label: '誠実性' },
    { key: 'extraversion', label: '外向性' },
    { key: 'agreeableness', label: '協調性' },
    { key: 'neuroticism', label: '神経症傾向' },
  ]
  const scores = traits.map(t => (result[t.key] as number) ?? 0)
  const labels = traits.map(t => t.label)
  const evidence = (result.evidence as string[]) ?? []

  function getLevel(score: number): { label: string; color: string } {
    if (score >= 65) return { label: 'HIGH', color: 'var(--green)' }
    if (score >= 40) return { label: 'MID', color: 'var(--text3)' }
    return { label: 'LOW', color: 'var(--amber)' }
  }

  // Extract per-trait descriptions from summary if available
  const summary = String(result.summary ?? '')

  return (
    <div>
      {/* Pentagon Radar */}
      <div style={{ marginBottom: 24 }}>
        <PentagonRadar scores={scores} labels={labels} size={300} />
      </div>

      {/* Factor cards - 2 column grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 12,
        marginBottom: 20,
      }}>
        {traits.map((t, i) => {
          const score = scores[i]
          const level = getLevel(score)
          return (
            <div key={t.key} style={{
              padding: '12px 16px', background: 'var(--surface2)', borderRadius: 8,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700, color: 'var(--accent2)' }}>{score}</span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                    background: level.color === 'var(--green)' ? 'rgba(34,197,94,0.15)' :
                               level.color === 'var(--amber)' ? 'rgba(245,158,11,0.15)' :
                               'rgba(255,255,255,0.08)',
                    color: level.color,
                    letterSpacing: '.05em',
                  }}>
                    {level.label}
                  </span>
                </div>
              </div>
              <div style={{ height: 4, background: 'var(--bg)', borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ height: '100%', width: `${score}%`, background: 'var(--accent)', borderRadius: 2 }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary */}
      {summary && <FormattedDescription text={summary} />}

      {/* Evidence */}
      <EvidenceList evidence={evidence} />

      {/* Changes */}
      <ChangesFromPrevious result={result} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Detail Tab: StrengthsFinder
// ---------------------------------------------------------------------------
function SfDetail({ result }: { result: Record<string, unknown> }) {
  const strengths = (result.top_strengths as { name: string; name_en?: string; score: number; domain: string; evidence: string }[]) ?? []
  const domainSummary = result.domain_summary as Record<string, { score: number; label: string; description?: string }> | undefined
  const workFit = (result.work_fit as string[]) ?? []
  const growthAreas = (result.growth_areas as string[]) ?? []
  const domainColors: Record<string, string> = {
    strategic_thinking: 'var(--accent)',
    relationship_building: 'var(--green)',
    influencing: 'var(--amber)',
    executing: 'var(--red)',
  }
  const domainTagColors: Record<string, string> = {
    '戦略的思考力': 'var(--accent)',
    '人間関係構築力': 'var(--green)',
    '影響力': 'var(--amber)',
    '実行力': 'var(--red)',
  }

  return (
    <div>
      {/* Top 5 Strengths */}
      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>
        Top 5 Strengths
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {strengths.map((s, i) => (
          <div key={i} style={{ padding: '14px 16px', background: 'var(--surface2)', borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent2)', fontFamily: 'var(--mono)' }}>#{i + 1}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{s.name}</span>
                  {s.name_en && <span style={{ fontSize: 11, color: 'var(--text3)' }}>({s.name_en})</span>}
                </div>
              </div>
              <span style={{
                fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                background: domainTagColors[s.domain] ? `${domainTagColors[s.domain]}22` : 'var(--accent-bg)',
                color: domainTagColors[s.domain] ?? 'var(--accent)',
              }}>
                {s.domain}
              </span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700, color: 'var(--accent2)' }}>{s.score}</span>
            </div>
            <div style={{ height: 5, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ height: '100%', width: `${s.score}%`, background: 'var(--accent)', borderRadius: 3 }} />
            </div>
            {s.evidence && (
              <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.6, fontStyle: 'italic' }}>
                {s.evidence}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 4 Domain Balance */}
      {domainSummary && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            4 Domain Balance
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(domainSummary).map(([key, val]) => (
              <div key={key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text2)', fontWeight: 500 }}>{val.label}</span>
                  <span style={{ fontFamily: 'var(--mono)', color: 'var(--text2)', fontWeight: 600 }}>{val.score}</span>
                </div>
                <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${val.score}%`, background: domainColors[key] ?? 'var(--accent)', borderRadius: 4 }} />
                </div>
                {val.description && (
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{val.description}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Work Fit Tags */}
      {workFit.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            適合する仕事
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {workFit.map((w, i) => (
              <span key={i} style={{
                fontSize: 12, padding: '5px 14px', background: 'var(--accent-bg)',
                color: 'var(--accent2)', borderRadius: 16, fontWeight: 500,
              }}>{w}</span>
            ))}
          </div>
        </div>
      )}

      {/* Growth Areas */}
      {growthAreas.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            成長領域
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {growthAreas.map((g, i) => (
              <div key={i} style={{
                fontSize: 12, color: 'var(--text2)', padding: '10px 14px',
                background: 'var(--surface2)', borderRadius: 8, lineHeight: 1.6,
                borderLeft: '3px solid var(--accent)',
              }}>
                <span style={{ fontWeight: 600, color: 'var(--accent2)', marginRight: 8 }}>{i + 1}.</span>
                {g}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      {Boolean(result.summary) && <FormattedDescription text={String(result.summary)} />}

      <ChangesFromPrevious result={result} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Detail Tab: Values
// ---------------------------------------------------------------------------
function ValuesDetail({ result }: { result: Record<string, unknown> }) {
  const values = (result.values as { name: string; rank: number; score: number; evidence: string }[]) ?? []
  const amberShades = ['rgba(245,158,11,1)', 'rgba(245,158,11,0.8)', 'rgba(245,158,11,0.65)', 'rgba(245,158,11,0.5)', 'rgba(245,158,11,0.35)', 'rgba(245,158,11,0.25)', 'rgba(245,158,11,0.2)']

  return (
    <div>
      {/* Ranking */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {values.map((v, i) => (
          <div key={v.rank} style={{ padding: '12px 16px', background: 'var(--surface2)', borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: amberShades[i] ?? 'var(--amber)', fontFamily: 'var(--mono)' }}>#{v.rank}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', flex: 1 }}>{v.name}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700, color: amberShades[i] ?? 'var(--amber)' }}>{v.score}</span>
            </div>
            <div style={{ height: 6, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ height: '100%', width: `${v.score}%`, background: amberShades[i] ?? 'var(--amber)', borderRadius: 3 }} />
            </div>
            {v.evidence && (
              <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.6, fontStyle: 'italic' }}>
                {v.evidence}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Value Changes */}
      {Boolean(result.changes) && (
        <div style={{
          padding: '12px 16px', background: 'var(--surface2)', borderRadius: 8,
          marginBottom: 16, borderLeft: '3px solid var(--amber)',
        }}>
          <div style={{ fontSize: 11, color: 'var(--amber)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            価値観の変化
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>{String(result.changes)}</div>
        </div>
      )}

      {/* Summary */}
      {Boolean(result.summary) && <FormattedDescription text={String(result.summary)} />}

      <ChangesFromPrevious result={result} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Progress Stepper (during analysis)
// ---------------------------------------------------------------------------
function ProgressStepper({ currentType, completedTypes }: { currentType: AnalysisType | null; completedTypes: Set<string> }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, padding: '16px 0' }}>
      {ALL_TYPES.map((type, i) => {
        const isCompleted = completedTypes.has(type)
        const isCurrent = type === currentType
        const meta = TAB_META[type]
        return (
          <div key={type} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isCompleted ? 'var(--green)' : isCurrent ? 'var(--accent)' : 'var(--surface2)',
                color: isCompleted || isCurrent ? '#fff' : 'var(--text3)',
                fontSize: 14, fontWeight: 600,
                position: 'relative',
              }}>
                {isCompleted ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : isCurrent ? (
                  <div style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: '2px solid #fff', borderTopColor: 'transparent',
                    animation: 'spin 1s linear infinite',
                  }} />
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              <span style={{ fontSize: 10, color: isCurrent ? 'var(--accent)' : isCompleted ? 'var(--green)' : 'var(--text3)', fontWeight: 500 }}>
                {meta.label}
              </span>
            </div>
            {i < ALL_TYPES.length - 1 && (
              <div style={{
                width: 40, height: 2, margin: '0 4px',
                marginBottom: 18,
                background: completedTypes.has(ALL_TYPES[i + 1]) || completedTypes.has(type) ? 'var(--green)' : 'var(--surface2)',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------
function EmptyStateView({ diaryCount, onRun, disabled }: { diaryCount: number; onRun: () => void; disabled: boolean }) {
  const progress = Math.min((diaryCount / 20) * 100, 100)
  const canRun = diaryCount >= 20

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '60px 20px', textAlign: 'center',
    }}>
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{ marginBottom: 20, opacity: 0.6 }}>
        <circle cx="32" cy="32" r="28" stroke="var(--text3)" strokeWidth="2" strokeDasharray="4 4" />
        <circle cx="32" cy="22" r="8" stroke="var(--accent)" strokeWidth="2" />
        <path d="M18 48c0-7.73 6.27-14 14-14s14 6.27 14 14" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
        まだ分析がありません
      </div>
      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 24, maxWidth: 360, lineHeight: 1.6 }}>
        日記データをもとに、MBTI / Big5 / StrengthsFinder / 価値観の4つの観点からあなたを分析します。
      </div>

      {/* Diary progress */}
      <div style={{ width: '100%', maxWidth: 300, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>
          <span>日記</span>
          <span>{diaryCount} / 20件</span>
        </div>
        <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${progress}%`,
            background: canRun ? 'var(--green)' : 'var(--accent)',
            borderRadius: 3, transition: 'width 0.3s',
          }} />
        </div>
        {!canRun && (
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
            分析には20件以上の日記が必要です
          </div>
        )}
      </div>

      <button className="btn btn-p" disabled={disabled || !canRun} onClick={onRun} style={{ padding: '10px 32px' }}>
        分析を開始
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function SelfAnalysis() {
  const { diaryEntries, fetchDiary, fetchTasks, fetchDreams } = useDataStore()
  const [loading, setLoading] = useState(true)
  const [pastResults, setPastResults] = useState<AnalysisRecord[]>([])
  const [activeTab, setActiveTab] = useState<TabType>('mbti')
  const [completedTypes, setCompletedTypes] = useState<Set<string>>(new Set())
  const [isRunningAll, setIsRunningAll] = useState(false)

  const { runAnalysis, running, runningType, error: analysisError } = useSelfAnalysis()

  const diaryCount = diaryEntries.length
  const hasResults = pastResults.length > 0

  const load = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchDiary({ days: 365 }), fetchTasks(), fetchDreams()])
    const { data } = await supabase
      .from('self_analysis')
      .select('*')
      .order('created_at', { ascending: false })
    setPastResults((data as AnalysisRecord[]) ?? [])
    setLoading(false)
  }, [fetchDiary, fetchTasks, fetchDreams])

  useEffect(() => { load() }, [load])

  // Run all analyses sequentially with stepper
  const handleRunAll = useCallback(async () => {
    setIsRunningAll(true)
    setCompletedTypes(new Set())
    for (const type of ALL_TYPES) {
      const result = await runAnalysis(type)
      if (result) {
        setPastResults((prev) => {
          const filtered = prev.filter((r) => r.analysis_type !== type)
          return [result, ...filtered]
        })
        setCompletedTypes((prev) => new Set([...prev, type]))
      }
    }
    setIsRunningAll(false)
  }, [runAnalysis])

  // Get latest result per type
  const latestByType = (type: AnalysisType) =>
    pastResults.find((r) => r.analysis_type === type)

  const activeResult = latestByType(activeTab)

  if (loading) {
    return (
      <div className="page">
        <PageHeader title="Self-Analysis" />
        <div style={{ color: 'var(--text3)' }}>Loading...</div>
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        title="Self-Analysis"
        description="日記データからあなたを多角的に分析します"
        actions={
          hasResults ? (
            <button
              className="btn btn-p"
              disabled={running || diaryCount < 20}
              onClick={handleRunAll}
              style={{ whiteSpace: 'nowrap' }}
            >
              {running || isRunningAll ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    display: 'inline-block', width: 12, height: 12, borderRadius: '50%',
                    border: '2px solid currentColor', borderTopColor: 'transparent',
                    animation: 'spin 1s linear infinite',
                  }} />
                  分析中...
                </span>
              ) : '再分析'}
            </button>
          ) : undefined
        }
      />

      {/* Analysis Error */}
      {analysisError && (
        <div style={{ fontSize: 12, color: 'var(--red)', padding: '8px 12px', background: 'var(--surface2)', borderRadius: 8, marginBottom: 16 }}>
          {analysisError}
        </div>
      )}

      {/* Progress Stepper during analysis */}
      {isRunningAll && (
        <div className="section">
          <Card>
            <ProgressStepper currentType={runningType} completedTypes={completedTypes} />
          </Card>
        </div>
      )}

      {/* Empty State */}
      {!hasResults && !isRunningAll && (
        <Card>
          <EmptyStateView diaryCount={diaryCount} onRun={handleRunAll} disabled={running} />
        </Card>
      )}

      {/* Dashboard + Detail when results exist */}
      {hasResults && (
        <>
          {/* Dashboard 2x2 Grid */}
          <div className="section">
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 12,
            }}>
              {ALL_TYPES.map((type) => {
                const r = latestByType(type)
                if (!r) return <div key={type} />
                const meta = TAB_META[type]
                const isActive = activeTab === type
                return (
                  <Card
                    key={type}
                    style={{
                      cursor: 'pointer',
                      border: isActive ? '1px solid var(--accent)' : '1px solid transparent',
                      transition: 'border-color 0.2s',
                    }}
                    onClick={() => setActiveTab(type)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: isActive ? 'var(--accent)' : 'var(--text2)' }}>{meta.title}</span>
                      <span style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                        {new Date(r.created_at).toLocaleDateString('ja-JP')}
                      </span>
                    </div>
                    {type === 'mbti' && <MbtiDashCard result={r.result} />}
                    {type === 'big5' && <Big5DashCard result={r.result} />}
                    {type === 'strengths_finder' && <SfDashCard result={r.result} />}
                    {type === 'values' && <ValuesDashCard result={r.result} />}
                  </Card>
                )
              })}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="section">
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
              {ALL_TYPES.map((type) => {
                const meta = TAB_META[type]
                const isActive = activeTab === type
                return (
                  <button
                    key={type}
                    onClick={() => setActiveTab(type)}
                    style={{
                      padding: '10px 20px',
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? 'var(--accent)' : 'var(--text3)',
                      background: 'none',
                      border: 'none',
                      borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                      cursor: 'pointer',
                      transition: 'color 0.2s, border-color 0.2s',
                      marginBottom: -1,
                    }}
                  >
                    {meta.label}
                  </button>
                )
              })}
            </div>

            {/* Detail Content */}
            {activeResult ? (
              <Card>
                {activeTab === 'mbti' && <MbtiDetail result={activeResult.result} />}
                {activeTab === 'big5' && <Big5Detail result={activeResult.result} />}
                {activeTab === 'strengths_finder' && <SfDetail result={activeResult.result} />}
                {activeTab === 'values' && <ValuesDetail result={activeResult.result} />}
              </Card>
            ) : (
              <Card>
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text3)', fontSize: 13 }}>
                  この分析はまだ実行されていません
                </div>
              </Card>
            )}
          </div>
        </>
      )}

      {/* Diary count hint when results exist but low count */}
      {hasResults && diaryCount < 20 && (
        <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginTop: 8 }}>
          分析には日記20件以上が必要です（現在 {diaryCount}件）
        </div>
      )}
    </div>
  )
}
