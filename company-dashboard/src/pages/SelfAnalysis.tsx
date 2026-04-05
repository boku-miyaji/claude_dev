import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, PageHeader } from '@/components/ui'
import { useSelfAnalysis, type AnalysisType, type AnalysisRecord } from '@/hooks/useSelfAnalysis'
import { useDataStore } from '@/stores/data'

const ALL_TYPES: AnalysisType[] = ['mbti', 'big5', 'strengths_finder', 'values']

const TYPE_META: Record<AnalysisType, { icon: string; title: string }> = {
  mbti: { icon: '🧩', title: 'MBTI' },
  big5: { icon: '📊', title: 'Big5' },
  strengths_finder: { icon: '🏆', title: 'ストレングスファインダー' },
  emotion_triggers: { icon: '🗺️', title: '感情トリガー' },
  values: { icon: '🎯', title: '価値観' },
}

// ---------------------------------------------------------------------------
// Shared: Changes badge
// ---------------------------------------------------------------------------
function ChangesFromPrevious({ result }: { result: Record<string, unknown> }) {
  const changes = result.changes_from_previous as string | undefined
  if (!changes) return null
  return (
    <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(91,141,239,0.08)', borderRadius: 8, borderLeft: '3px solid var(--accent)' }}>
      <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
        前回からの変化
      </div>
      <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>{changes}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helper: split long description into structured sections
// ---------------------------------------------------------------------------
function FormattedDescription({ text }: { text: string }) {
  // Split by known section headers like 【...】
  const sections = text.split(/(?=【)/).filter(Boolean)
  if (sections.length <= 1) {
    // No structured sections — render as paragraphs
    return (
      <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.8 }}>
        {text.split('\n').filter(Boolean).map((p, i) => <p key={i} style={{ marginBottom: 8 }}>{p}</p>)}
      </div>
    )
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
          <div key={i} style={{ padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent2)', marginBottom: 6 }}>{header}</div>
            {lines.map((line, j) => {
              // Numbered list items (1. 2. 3.)
              const numMatch = line.match(/^(\d+)\)\s*(.+)/)
              if (numMatch) {
                return <div key={j} style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7, paddingLeft: 8, marginBottom: 2 }}>{numMatch[1]}. {numMatch[2]}</div>
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
// Result renderers
// ---------------------------------------------------------------------------

function MbtiResult({ result }: { result: Record<string, unknown> }) {
  const dims = result.dimensions as Record<string, { score: number; label: string }> | undefined
  const typeName = result.type_name as string | undefined
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--accent2)', fontFamily: 'var(--mono)' }}>
          {String(result.type)}
        </div>
        {typeName && (
          <div style={{ fontSize: 14, color: 'var(--text2)', marginTop: 4 }}>{typeName}</div>
        )}
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>確信度: {String(result.confidence)}</div>
      </div>
      {dims && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {Object.entries(dims).map(([key, val]) => {
            const labels = key.split('_')
            const pct = ((val.score + 100) / 200) * 100
            return (
              <div key={key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>
                  <span>{labels[0]}</span>
                  <span style={{ color: 'var(--text3)' }}>{val.label}</span>
                  <span>{labels[1]}</span>
                </div>
                <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                  <div style={{
                    position: 'absolute',
                    left: `${Math.min(pct, 50)}%`,
                    width: `${Math.abs(pct - 50)}%`,
                    height: '100%',
                    background: 'var(--accent)',
                    borderRadius: 3,
                  }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
      {Boolean(result.description) && <FormattedDescription text={String(result.description)} />}
      <ChangesFromPrevious result={result} />
    </div>
  )
}

function Big5Result({ result }: { result: Record<string, unknown> }) {
  const traits = [
    { key: 'openness', label: '開放性' },
    { key: 'conscientiousness', label: '誠実性' },
    { key: 'extraversion', label: '外向性' },
    { key: 'agreeableness', label: '協調性' },
    { key: 'neuroticism', label: '神経症傾向' },
  ]
  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        {traits.map((t) => {
          const val = (result[t.key] as number) ?? 0
          return (
            <div key={t.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: 'var(--text2)' }}>{t.label}</span>
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--accent2)', fontWeight: 600 }}>{val}</span>
              </div>
              <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${val}%`, background: 'var(--accent)', borderRadius: 3 }} />
              </div>
            </div>
          )
        })}
      </div>
      {Boolean(result.summary) && <FormattedDescription text={String(result.summary)} />}
      <ChangesFromPrevious result={result} />
    </div>
  )
}

function StrengthsFinderResult({ result }: { result: Record<string, unknown> }) {
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
  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {strengths.map((s, i) => (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                {i + 1}. {s.name}{s.name_en ? ` (${s.name_en})` : ''}
              </span>
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--accent2)', fontWeight: 600 }}>{s.score}</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>{s.domain}</div>
            <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
              <div style={{ height: '100%', width: `${s.score}%`, background: 'var(--accent)', borderRadius: 2 }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>{s.evidence}</div>
          </div>
        ))}
      </div>
      {domainSummary && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 8 }}>4つの領域</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(domainSummary).map(([key, val]) => (
              <div key={key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text2)' }}>{val.label}</span>
                  <span style={{ fontFamily: 'var(--mono)', color: 'var(--text2)', fontWeight: 600 }}>{val.score}</span>
                </div>
                <div style={{ height: 5, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${val.score}%`, background: domainColors[key] ?? 'var(--accent)', borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {workFit.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 6 }}>適合する仕事</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {workFit.map((w, i) => (
              <span key={i} style={{ fontSize: 11, padding: '3px 10px', background: 'var(--accent-bg)', color: 'var(--accent2)', borderRadius: 12, fontWeight: 500 }}>{w}</span>
            ))}
          </div>
        </div>
      )}
      {growthAreas.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 6 }}>成長領域</div>
          {growthAreas.map((g, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text2)', padding: '6px 10px', background: 'var(--surface2)', borderRadius: 6, marginBottom: 4 }}>{g}</div>
          ))}
        </div>
      )}
      {Boolean(result.summary) && <FormattedDescription text={String(result.summary)} />}
      <ChangesFromPrevious result={result} />
    </div>
  )
}

function ValuesResult({ result }: { result: Record<string, unknown> }) {
  const values = (result.values as { name: string; rank: number; score: number; evidence: string }[]) ?? []
  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {values.map((v) => (
          <div key={v.rank}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>#{v.rank} {v.name}</span>
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--amber)', fontWeight: 600 }}>{v.score}</span>
            </div>
            <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
              <div style={{ height: '100%', width: `${v.score}%`, background: 'var(--amber)', borderRadius: 2 }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>{v.evidence}</div>
          </div>
        ))}
      </div>
      {Boolean(result.changes) && (
        <div style={{ fontSize: 12, color: 'var(--text2)', padding: '8px 12px', background: 'var(--surface2)', borderRadius: 8, marginBottom: 12, lineHeight: 1.6 }}>
          {String(result.changes)}
        </div>
      )}
      {Boolean(result.summary) && <FormattedDescription text={String(result.summary)} />}
      <ChangesFromPrevious result={result} />
    </div>
  )
}

function AnalysisResultView({ type, result }: { type: AnalysisType; result: Record<string, unknown> }) {
  switch (type) {
    case 'mbti': return <MbtiResult result={result} />
    case 'big5': return <Big5Result result={result} />
    case 'strengths_finder': return <StrengthsFinderResult result={result} />
    case 'values': return <ValuesResult result={result} />
    default: return null
  }
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function SelfAnalysis() {
  const { diaryEntries, fetchDiary, fetchTasks, fetchDreams } = useDataStore()
  const [loading, setLoading] = useState(true)
  const [pastResults, setPastResults] = useState<AnalysisRecord[]>([])
  const [runAllProgress, setRunAllProgress] = useState<string | null>(null)

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

  // Run all analyses sequentially
  const handleRunAll = useCallback(async () => {
    for (const type of ALL_TYPES) {
      setRunAllProgress(`${TYPE_META[type].title}を分析中...`)
      const result = await runAnalysis(type)
      if (result) {
        setPastResults((prev) => {
          // Replace existing result for this type, or prepend
          const filtered = prev.filter((r) => r.analysis_type !== type)
          return [result, ...filtered]
        })
      }
    }
    setRunAllProgress(null)
  }, [runAnalysis])

  // Get latest result per type
  const latestByType = (type: AnalysisType) =>
    pastResults.find((r) => r.analysis_type === type)

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
      <PageHeader title="Self-Analysis" description="日記データからあなたを多角的に分析します" />

      {/* Run All button */}
      <div className="section">
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                {hasResults ? '差分分析を実行' : 'パーソナリティ分析を実行'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                {hasResults
                  ? `前回の分析以降の新しい日記をもとに、各分析を更新します`
                  : `${diaryCount}件の日記から MBTI・Big5・ストレングスファインダー・価値観を一括分析`}
              </div>
            </div>
            <button
              className="btn btn-p"
              disabled={running || diaryCount < 20}
              onClick={handleRunAll}
            >
              {running || runAllProgress ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    display: 'inline-block', width: 12, height: 12, borderRadius: '50%',
                    border: '2px solid currentColor', borderTopColor: 'transparent',
                    animation: 'spin 1s linear infinite',
                  }} />
                  {runAllProgress ?? `${TYPE_META[runningType!]?.title ?? ''}を分析中...`}
                </span>
              ) : hasResults ? '再分析' : '分析を開始'}
            </button>
          </div>
          {diaryCount < 20 && (
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
              分析には日記20件以上が必要です（現在 {diaryCount}件）
            </div>
          )}
        </Card>
      </div>

      {analysisError && (
        <div style={{ fontSize: 12, color: 'var(--red)', padding: '8px 12px', background: 'var(--surface2)', borderRadius: 8, marginBottom: 16 }}>
          {analysisError}
        </div>
      )}

      {/* Results — one card per analysis type */}
      {hasResults && (
        <div className="section">
          <div className="section-title">分析結果</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {ALL_TYPES.map((type) => {
              const r = latestByType(type)
              if (!r) return null
              const meta = TYPE_META[type]
              return (
                <Card key={type}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 20 }}>{meta.icon}</span>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{meta.title}</span>
                    <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', marginLeft: 'auto' }}>
                      {new Date(r.created_at).toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                  <AnalysisResultView type={type} result={r.result} />
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
