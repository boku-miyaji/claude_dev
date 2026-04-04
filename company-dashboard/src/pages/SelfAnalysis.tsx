import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, PageHeader } from '@/components/ui'
import { useSelfAnalysis, type AnalysisType, type AnalysisRecord } from '@/hooks/useSelfAnalysis'
import { useDataStore } from '@/stores/data'

interface AnalysisCard {
  id: AnalysisType
  title: string
  description: string
  icon: string
  requiredTable: string
  requiredCount: number
  extraRequirement?: string
  unlocked: boolean
  currentCount: number
}

/** Render MBTI result */
function MbtiResult({ result }: { result: Record<string, unknown> }) {
  const dims = result.dimensions as Record<string, { score: number; label: string }> | undefined
  const evidence = result.evidence as string[] | undefined
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent2)', fontFamily: 'var(--mono)' }}>
          {String(result.type)}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
          確信度: {String(result.confidence)}
        </div>
      </div>
      {dims && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
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
      {Boolean(result.description) && (
        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 12 }}>
          {String(result.description)}
        </div>
      )}
      {evidence && evidence.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 6 }}>根拠</div>
          {evidence.map((e, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text2)', padding: '6px 10px', background: 'var(--surface2)', borderRadius: 6, marginBottom: 4, fontStyle: 'italic' }}>
              {e}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Render Big5 result */
function Big5Result({ result }: { result: Record<string, unknown> }) {
  const traits = [
    { key: 'openness', label: '開放性' },
    { key: 'conscientiousness', label: '誠実性' },
    { key: 'extraversion', label: '外向性' },
    { key: 'agreeableness', label: '協調性' },
    { key: 'neuroticism', label: '神経症傾向' },
  ]
  const evidence = result.evidence as string[] | undefined
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
                <div style={{ height: '100%', width: `${val}%`, background: 'var(--accent)', borderRadius: 3, transition: 'width .4s' }} />
              </div>
            </div>
          )
        })}
      </div>
      {Boolean(result.summary) && (
        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 12 }}>
          {String(result.summary)}
        </div>
      )}
      {evidence && evidence.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 6 }}>根拠</div>
          {evidence.map((e, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text2)', padding: '6px 10px', background: 'var(--surface2)', borderRadius: 6, marginBottom: 4, fontStyle: 'italic' }}>
              {e}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Render Strengths result */
function StrengthsResult({ result }: { result: Record<string, unknown> }) {
  const strengths = (result.top_strengths as { name: string; score: number; evidence: string }[]) ?? []
  const workFit = (result.work_fit as string[]) ?? []
  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {strengths.map((s, i) => (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                {i + 1}. {s.name}
              </span>
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--green)', fontWeight: 600 }}>{s.score}</span>
            </div>
            <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
              <div style={{ height: '100%', width: `${s.score}%`, background: 'var(--green)', borderRadius: 2 }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>{s.evidence}</div>
          </div>
        ))}
      </div>
      {workFit.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 6 }}>適合する仕事</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {workFit.map((w, i) => (
              <span key={i} style={{ fontSize: 11, padding: '3px 10px', background: 'var(--accent-bg)', color: 'var(--accent2)', borderRadius: 12, fontWeight: 500 }}>
                {w}
              </span>
            ))}
          </div>
        </div>
      )}
      {Boolean(result.summary) && (
        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginTop: 12 }}>
          {String(result.summary)}
        </div>
      )}
    </div>
  )
}

/** Render StrengthsFinder result */
function StrengthsFinderResult({ result }: { result: Record<string, unknown> }) {
  const strengths = (result.top_strengths as { name: string; score: number; domain: string; evidence: string }[]) ?? []
  const domainSummary = result.domain_summary as Record<string, { score: number; label: string }> | undefined
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
      {/* Top 5 strengths with bar chart */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {strengths.map((s, i) => (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                {i + 1}. {s.name}
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

      {/* Domain summary - 4 domains */}
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
                  <div style={{ height: '100%', width: `${val.score}%`, background: domainColors[key] ?? 'var(--accent)', borderRadius: 3, transition: 'width .4s' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Work fit tags */}
      {workFit.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 6 }}>適合する仕事</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {workFit.map((w, i) => (
              <span key={i} style={{ fontSize: 11, padding: '3px 10px', background: 'var(--accent-bg)', color: 'var(--accent2)', borderRadius: 12, fontWeight: 500 }}>
                {w}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Growth areas */}
      {growthAreas.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 6 }}>成長領域</div>
          {growthAreas.map((g, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text2)', padding: '6px 10px', background: 'var(--surface2)', borderRadius: 6, marginBottom: 4 }}>
              {g}
            </div>
          ))}
        </div>
      )}

      {Boolean(result.summary) && (
        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
          {String(result.summary)}
        </div>
      )}
    </div>
  )
}

/** Render Emotion Triggers result */
function EmotionTriggersResult({ result }: { result: Record<string, unknown> }) {
  const positive = (result.positive_triggers as { trigger: string; emotion: string; frequency: number }[]) ?? []
  const negative = (result.negative_triggers as { trigger: string; emotion: string; frequency: number }[]) ?? []
  const patterns = (result.patterns as string[]) ?? []
  return (
    <div>
      {positive.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.08em' }}>
            Positive Triggers
          </div>
          {positive.map((t, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
              <span style={{ color: 'var(--text2)' }}>{t.trigger}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: 'var(--text3)', fontSize: 10 }}>{t.emotion}</span>
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--green)', fontWeight: 600 }}>{t.frequency}x</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {negative.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.08em' }}>
            Negative Triggers
          </div>
          {negative.map((t, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
              <span style={{ color: 'var(--text2)' }}>{t.trigger}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: 'var(--text3)', fontSize: 10 }}>{t.emotion}</span>
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--red)', fontWeight: 600 }}>{t.frequency}x</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {patterns.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 6 }}>パターン</div>
          {patterns.map((p, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text2)', padding: '6px 10px', background: 'var(--surface2)', borderRadius: 6, marginBottom: 4 }}>
              {p}
            </div>
          ))}
        </div>
      )}
      {Boolean(result.summary) && (
        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginTop: 12 }}>
          {String(result.summary)}
        </div>
      )}
    </div>
  )
}

/** Render Values result */
function ValuesResult({ result }: { result: Record<string, unknown> }) {
  const values = (result.values as { name: string; rank: number; score: number; evidence: string }[]) ?? []
  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {values.map((v) => (
          <div key={v.rank}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                #{v.rank} {v.name}
              </span>
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
      {Boolean(result.summary) && (
        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
          {String(result.summary)}
        </div>
      )}
    </div>
  )
}

/** Render result based on analysis type */
function AnalysisResultView({ type, result }: { type: AnalysisType; result: Record<string, unknown> }) {
  switch (type) {
    case 'mbti': return <MbtiResult result={result} />
    case 'big5': return <Big5Result result={result} />
    case 'strengths': return <StrengthsResult result={result} />
    case 'strengths_finder': return <StrengthsFinderResult result={result} />
    case 'emotion_triggers': return <EmotionTriggersResult result={result} />
    case 'values': return <ValuesResult result={result} />
  }
}

export function SelfAnalysis() {
  const { diaryEntries, tasks, dreams, fetchDiary, fetchTasks, fetchDreams } = useDataStore()
  const [hasEmotionData, setHasEmotionData] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pastResults, setPastResults] = useState<AnalysisRecord[]>([])

  const { runAnalysis, running, runningType, error: analysisError } = useSelfAnalysis()

  // Use counts from central store
  const diaryCount = diaryEntries.length
  const taskCount = tasks.length
  const dreamCount = dreams.length

  const load = useCallback(async () => {
    setLoading(true)

    // Fetch data through store (cached)
    await Promise.all([
      fetchDiary({ days: 365 }),
      fetchTasks(),
      fetchDreams(),
    ])

    // These two still need direct queries (not in central store)
    const [emotionRes, resultsRes] = await Promise.all([
      supabase
        .from('diary_entries')
        .select('id')
        .not('emotion_scores', 'is', null)
        .limit(1),
      supabase
        .from('self_analysis')
        .select('*')
        .order('created_at', { ascending: false }),
    ])
    setHasEmotionData((emotionRes.data?.length ?? 0) > 0)
    setPastResults((resultsRes.data as AnalysisRecord[]) ?? [])
    setLoading(false)
  }, [fetchDiary, fetchTasks, fetchDreams])

  useEffect(() => { load() }, [load])

  const handleRunAnalysis = useCallback(async (type: AnalysisType) => {
    const result = await runAnalysis(type)
    if (result) {
      setPastResults((prev) => [result, ...prev])
    }
  }, [runAnalysis])

  const analyses: AnalysisCard[] = [
    {
      id: 'mbti',
      title: 'MBTI推定',
      description: '日記の文体と内容から、あなたのMBTIタイプを推定します。',
      icon: '🧩',
      requiredTable: 'diary_entries',
      requiredCount: 20,
      currentCount: diaryCount,
      unlocked: diaryCount >= 20,
    },
    {
      id: 'big5',
      title: 'Big5 パーソナリティ',
      description: '開放性・誠実性・外向性・協調性・神経症傾向の5因子を分析します。',
      icon: '📊',
      requiredTable: 'diary_entries',
      requiredCount: 30,
      currentCount: diaryCount,
      unlocked: diaryCount >= 30,
    },
    {
      id: 'strengths',
      title: '強み・才能分析',
      description: 'タスクの実績と日記から、あなたの強みパターンを発見します。',
      icon: '💎',
      requiredTable: 'tasks',
      requiredCount: 50,
      currentCount: taskCount,
      unlocked: taskCount >= 50,
    },
    {
      id: 'strengths_finder',
      title: 'ストレングスファインダー',
      description: 'CliftonStrengthsの34資質からTop5を推定し、4つの領域バランスを可視化します。',
      icon: '🏆',
      requiredTable: 'diary_entries',
      requiredCount: 20,
      currentCount: diaryCount,
      unlocked: diaryCount >= 20,
    },
    {
      id: 'emotion_triggers',
      title: '感情トリガーマップ',
      description: 'どんな出来事がどんな感情を引き起こすか、パターンを可視化します。',
      icon: '🗺️',
      requiredTable: 'diary_entries',
      requiredCount: 30,
      extraRequirement: '感情データあり',
      currentCount: diaryCount,
      unlocked: diaryCount >= 30 && hasEmotionData,
    },
    {
      id: 'values',
      title: '価値観の優先順位',
      description: '日記と夢リストから、あなたが大切にしていることを明らかにします。',
      icon: '🎯',
      requiredTable: 'diary_entries',
      requiredCount: 50,
      extraRequirement: '夢リストあり',
      currentCount: diaryCount,
      unlocked: diaryCount >= 50 && dreamCount > 0,
    },
  ]

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
      <PageHeader title="Self-Analysis" description="あなたのことを分析します" />

      {/* Profile overview */}
      <div className="section">
        <div className="section-title">プロファイル概要</div>
        <Card>
          {diaryCount < 10 ? (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🧠</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>
                分析にはデータが必要です
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                Today ページで日記を書くと分析が始まります
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent2)' }}>{diaryCount}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>日記</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--green)' }}>{taskCount}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>タスク</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--amber)' }}>{dreamCount}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>夢</div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Analysis error */}
      {analysisError && (
        <div style={{ fontSize: 12, color: 'var(--red)', padding: '8px 12px', background: 'var(--surface2)', borderRadius: 8, marginBottom: 16 }}>
          {analysisError}
        </div>
      )}

      {/* Analysis cards */}
      <div className="section">
        <div className="section-title">利用可能な分析</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {analyses.map((a) => {
            const pct = Math.min((a.currentCount / a.requiredCount) * 100, 100)
            const remaining = Math.max(a.requiredCount - a.currentCount, 0)
            const latestResult = pastResults.find((r) => r.analysis_type === a.id)
            const isRunning = running && runningType === a.id

            return (
              <Card key={a.id}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ fontSize: 24, flexShrink: 0 }}>{a.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{a.title}</span>
                      <span style={{ fontSize: 12 }}>{a.unlocked ? '🔓' : '🔒'}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8, lineHeight: 1.5 }}>
                      {a.description}
                    </div>

                    {/* Progress bar */}
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${pct}%`,
                          background: a.unlocked ? 'var(--green)' : 'var(--accent)',
                          borderRadius: 2,
                          transition: 'width .4s ease',
                        }} />
                      </div>
                    </div>

                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>
                      {a.requiredTable === 'diary_entries' ? '日記' : a.requiredTable === 'tasks' ? 'タスク' : 'データ'}
                      {' '}{a.currentCount}/{a.requiredCount}件
                      {!a.unlocked && remaining > 0 && ` (あと${remaining}件)`}
                      {a.extraRequirement && !a.unlocked && ` + ${a.extraRequirement}`}
                    </div>

                    {a.unlocked && (
                      <button
                        className="btn btn-p btn-sm"
                        style={{ marginTop: 10 }}
                        disabled={isRunning}
                        onClick={() => handleRunAnalysis(a.id)}
                      >
                        {isRunning ? (
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
                            分析中...
                          </span>
                        ) : latestResult ? '再分析する' : '分析を実行'}
                      </button>
                    )}

                    {/* Show latest result inline */}
                    {latestResult && (
                      <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                            最新の分析結果
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                            {new Date(latestResult.created_at).toLocaleDateString('ja-JP')}
                          </div>
                        </div>
                        <AnalysisResultView type={a.id} result={latestResult.result} />
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
