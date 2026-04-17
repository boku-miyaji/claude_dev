import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card, PageHeader } from '@/components/ui'
import { supabase } from '@/lib/supabase'

type Mode = 'quick' | 'medium' | 'deep'
const MODE_LIMITS: Record<Mode, number> = { quick: 5, medium: 15, deep: 30 }
const MODE_LABELS: Record<Mode, string> = { quick: 'Quick (5問 / 約5分)', medium: 'Medium (15問 / 約20分)', deep: 'Deep (30問 / じっくり)' }

const STAGES = [
  { key: 'childhood', label: '幼少期' },
  { key: 'elementary', label: '小学生' },
  { key: 'junior_high', label: '中学生' },
  { key: 'high_school', label: '高校生' },
  { key: 'university', label: '大学' },
  { key: 'early_career', label: '社会人初期' },
  { key: 'mid_career', label: '社会人中期' },
  { key: 'recent', label: '最近' },
]
const AXES = [
  { key: 'values', label: '価値観' },
  { key: 'family', label: '家庭' },
  { key: 'joy', label: '嬉しかった' },
  { key: 'struggle', label: '苦しかった' },
  { key: 'turning_point', label: '転機' },
  { key: 'career', label: '仕事' },
  { key: 'relationships', label: '人間関係' },
]

interface CoverageCell {
  stage: string
  axis: string
  count: number
  maxDepth: number
}

interface LifeEntry {
  id: number
  stage: string
  axis: string
  question: string
  answer: string
  depth_level: number
  created_at: string
}

interface NextQuestionResponse {
  question: string
  stage: string
  stage_label: string
  axis: string
  axis_label: string
  suggested_depth: number
  rationale?: string
  coverage: CoverageCell[]
}

interface Summary {
  digest: Array<{ stage: string; axis: string; text: string }>
  themes: string[]
  next_suggestions: string[]
  total_entries: number
}

async function callLifeStory<T = unknown>(body: Record<string, unknown>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token || ''
  const res = await fetch(import.meta.env.VITE_SUPABASE_URL + '/functions/v1/life-story', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`life-story ${res.status}: ${errBody.substring(0, 200)}`)
  }
  return res.json()
}

export function LifeHistory() {
  const [mode, setMode] = useState<Mode>('medium')
  const [focusStage, setFocusStage] = useState<string>('')
  const [focusAxis, setFocusAxis] = useState<string>('')

  const [coverage, setCoverage] = useState<CoverageCell[]>([])
  const [totalEntries, setTotalEntries] = useState(0)
  const [entries, setEntries] = useState<LifeEntry[]>([])
  const [expandedStage, setExpandedStage] = useState<string | null>(null)
  const [showHeatmap, setShowHeatmap] = useState(false)

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionActive, setSessionActive] = useState(false)
  const [questionCount, setQuestionCount] = useState(0)
  const [currentQ, setCurrentQ] = useState<NextQuestionResponse | null>(null)
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [dialogue, setDialogue] = useState<Array<{ stage_label: string; axis_label: string; question: string; answer: string }>>([])

  const answerRef = useRef<HTMLTextAreaElement>(null)

  const loadCoverage = useCallback(async () => {
    try {
      const res = await callLifeStory<{ coverage: CoverageCell[]; total_entries: number }>({ action: 'coverage' })
      setCoverage(res.coverage ?? [])
      setTotalEntries(res.total_entries ?? 0)
    } catch (err) {
      console.error('[LifeHistory] coverage load failed', err)
    }
  }, [])

  const loadEntries = useCallback(async () => {
    const { data } = await supabase
      .from('life_story_entries')
      .select('id, stage, axis, question, answer, depth_level, created_at')
      .order('created_at', { ascending: false })
      .limit(500)
    setEntries((data ?? []) as LifeEntry[])
  }, [])

  useEffect(() => { loadCoverage(); loadEntries() }, [loadCoverage, loadEntries])

  const requestNextQuestion = useCallback(async (sid: string) => {
    setLoading(true)
    setError(null)
    try {
      const body: Record<string, unknown> = { action: 'next_question', session_id: sid, mode }
      if (focusStage) body.focus_stage = focusStage
      if (focusAxis) body.focus_axis = focusAxis
      const res = await callLifeStory<NextQuestionResponse>(body)
      setCurrentQ(res)
      setAnswer('')
      setTimeout(() => answerRef.current?.focus(), 50)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [mode, focusStage, focusAxis])

  const startSession = useCallback(async () => {
    const sid = crypto.randomUUID()
    setSessionId(sid)
    setSessionActive(true)
    setQuestionCount(0)
    setDialogue([])
    setSummary(null)
    await requestNextQuestion(sid)
  }, [requestNextQuestion])

  const endSession = useCallback(async () => {
    if (!sessionId) return
    setSessionActive(false)
    setLoading(true)
    try {
      const res = await callLifeStory<Summary>({ action: 'summarize', session_id: sessionId })
      setSummary(res)
      await Promise.all([loadCoverage(), loadEntries()])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [sessionId, loadCoverage, loadEntries])

  const submitAnswer = useCallback(async () => {
    const text = answer.trim()
    if (!text || !currentQ || !sessionId) return
    setLoading(true)
    setError(null)
    try {
      await callLifeStory({
        action: 'answer',
        session_id: sessionId,
        stage: currentQ.stage,
        axis: currentQ.axis,
        question: currentQ.question,
        answer: text,
        depth_level: currentQ.suggested_depth ?? 1,
      })
      setDialogue((prev) => [...prev, {
        stage_label: currentQ.stage_label,
        axis_label: currentQ.axis_label,
        question: currentQ.question,
        answer: text,
      }])
      const newCount = questionCount + 1
      setQuestionCount(newCount)
      setAnswer('')
      if (newCount >= MODE_LIMITS[mode]) {
        await endSession()
      } else {
        await requestNextQuestion(sessionId)
      }
    } catch (err) {
      setError((err as Error).message)
      setLoading(false)
    }
  }, [answer, currentQ, sessionId, questionCount, mode, endSession, requestNextQuestion])

  const skipQuestion = useCallback(async () => {
    if (!sessionId) return
    setAnswer('')
    await requestNextQuestion(sessionId)
  }, [sessionId, requestNextQuestion])

  // Coverage heatmap cell lookup
  const coverageCell = useMemo(() => {
    const map = new Map<string, CoverageCell>()
    for (const c of coverage) map.set(`${c.stage}|${c.axis}`, c)
    return map
  }, [coverage])

  const entriesByStage = useMemo(() => {
    const map = new Map<string, LifeEntry[]>()
    for (const e of entries) {
      if (!map.has(e.stage)) map.set(e.stage, [])
      map.get(e.stage)!.push(e)
    }
    return map
  }, [entries])

  const heatmapCellStyle = (c: CoverageCell | undefined): React.CSSProperties => {
    const count = c?.count ?? 0
    const depth = c?.maxDepth ?? 0
    // count heat: 0=blank, 1-2=light, 3+=dense
    const bg = count === 0 ? 'var(--surface2)'
      : count <= 2 ? 'rgba(99, 102, 241, 0.18)'
      : count <= 5 ? 'rgba(99, 102, 241, 0.38)'
      : 'rgba(99, 102, 241, 0.62)'
    const text = count === 0 ? 'var(--text3)' : count >= 3 ? 'var(--text)' : 'var(--text2)'
    return {
      width: 32, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 10, color: text, background: bg,
      borderRadius: 4, fontFamily: 'var(--mono)',
      border: depth >= 4 ? '1px solid rgba(99, 102, 241, 0.6)' : '1px solid transparent',
    }
  }

  // ─── Render: Session active ─────────────────────────────────
  if (sessionActive && currentQ) {
    const total = MODE_LIMITS[mode]
    return (
      <div className="page">
        <PageHeader title="Roots — 人生の棚卸し" description={`${questionCount + 1} / ${total}問目`} />

        <Card>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--accent2)', padding: '2px 8px', background: 'rgba(99,102,241,0.12)', borderRadius: 12 }}>
              {currentQ.stage_label}
            </span>
            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text2)', padding: '2px 8px', background: 'var(--surface2)', borderRadius: 12 }}>
              {currentQ.axis_label}
            </span>
          </div>
          <div style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text)', marginBottom: 14, fontWeight: 500 }}>
            {currentQ.question}
          </div>
          {currentQ.rationale && (
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 14, fontStyle: 'italic' }}>
              なぜ今これを: {currentQ.rationale}
            </div>
          )}
          <textarea
            ref={answerRef}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submitAnswer() } }}
            placeholder="思い出したことを自由に…（Cmd/Ctrl + Enter で送信）"
            rows={6}
            style={{
              width: '100%', padding: 12, fontSize: 13, lineHeight: 1.7,
              border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)',
              color: 'var(--text)', resize: 'vertical', fontFamily: 'inherit',
            }}
            disabled={loading}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
            <button
              className="btn btn-p btn-sm"
              onClick={submitAnswer}
              disabled={!answer.trim() || loading}
            >
              {loading ? '保存中...' : '答える → 次の質問'}
            </button>
            <button className="btn btn-g btn-sm" onClick={skipQuestion} disabled={loading}>
              この質問はスキップ
            </button>
            <div style={{ flex: 1 }} />
            <button className="btn btn-ghost btn-sm" onClick={endSession} disabled={loading}>
              セッションを終える
            </button>
          </div>
          {error && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 8 }}>{error}</div>}
        </Card>

        {dialogue.length > 0 && (
          <div className="section" style={{ marginTop: 20 }}>
            <div className="section-title">このセッションで答えたこと</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {dialogue.map((d, i) => (
                <Card key={i}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--text3)' }}>{d.stage_label} · {d.axis_label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>{d.question}</div>
                  <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{d.answer}</div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── Render: Summary view after session end ─────────────────
  if (summary) {
    return (
      <div className="page">
        <PageHeader title="Roots — セッション完了" description={`${summary.total_entries}件の回答を整理しました`} />

        {summary.themes.length > 0 && (
          <div className="section">
            <div className="section-title">浮かび上がったテーマ</div>
            <Card>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8 }}>
                {summary.themes.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </Card>
          </div>
        )}

        {summary.digest.length > 0 && (
          <div className="section">
            <div className="section-title">ステージ別・軸別の言語化</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {summary.digest.map((d, i) => {
                const stageLabel = STAGES.find((s) => s.key === d.stage)?.label ?? d.stage
                const axisLabel = AXES.find((a) => a.key === d.axis)?.label ?? d.axis
                return (
                  <Card key={i}>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>
                      {stageLabel} · {axisLabel}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7 }}>{d.text}</div>
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {summary.next_suggestions.length > 0 && (
          <div className="section">
            <div className="section-title">次に深掘りするとよい</div>
            <Card>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8, color: 'var(--text2)' }}>
                {summary.next_suggestions.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </Card>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn btn-p btn-sm" onClick={() => { setSummary(null); startSession() }}>
            もう1セッション始める
          </button>
          <button className="btn btn-g btn-sm" onClick={() => setSummary(null)}>
            マップに戻る
          </button>
        </div>
      </div>
    )
  }

  // ─── Render: Landing (mode select + coverage map) ───────────
  return (
    <div className="page">
      <PageHeader
        title="Roots — 人生の棚卸し"
        description="日記では補えない過去・価値観・家庭環境を、質問に答えながら言語化します"
      />

      <Card>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
          モードを選んで始めると、AIが過去の回答を踏まえて質問を選びます。再度実行すると、深掘りが必要な領域から聞かれます。
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {(['quick', 'medium', 'deep'] as Mode[]).map((m) => (
            <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: `1px solid ${mode === m ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 6, cursor: 'pointer', background: mode === m ? 'rgba(99,102,241,0.08)' : 'transparent' }}>
              <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} />
              <span style={{ fontSize: 13, color: 'var(--text)' }}>{MODE_LABELS[m]}</span>
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={{ flex: '1 1 220px' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text3)', marginBottom: 4 }}>フォーカス（任意）</div>
            <select value={focusStage} onChange={(e) => setFocusStage(e.target.value)} style={{ width: '100%', padding: '6px 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)' }}>
              <option value="">全ステージ</option>
              {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div style={{ flex: '1 1 220px' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text3)', marginBottom: 4 }}>軸（任意）</div>
            <select value={focusAxis} onChange={(e) => setFocusAxis(e.target.value)} style={{ width: '100%', padding: '6px 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)' }}>
              <option value="">全軸</option>
              {AXES.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
            </select>
          </div>
        </div>

        <button className="btn btn-p btn-sm" onClick={startSession} disabled={loading}>
          {loading ? '準備中...' : '始める'}
        </button>
        {error && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 8 }}>{error}</div>}
      </Card>

      {/* Timeline — 人生の軌跡 */}
      <div className="section" style={{ marginTop: 24 }}>
        <div className="section-title">
          人生の軌跡（{totalEntries}件の記録）
        </div>
        <div style={{ position: 'relative', paddingLeft: 24 }}>
          {/* vertical line */}
          <div style={{ position: 'absolute', left: 7, top: 8, bottom: 8, width: 2, background: 'var(--border)' }} />
          {STAGES.map((s) => {
            const stageEntries = entriesByStage.get(s.key) ?? []
            const isExpanded = expandedStage === s.key
            const isEmpty = stageEntries.length === 0
            const byAxis = new Map<string, LifeEntry[]>()
            stageEntries.forEach((e) => {
              if (!byAxis.has(e.axis)) byAxis.set(e.axis, [])
              byAxis.get(e.axis)!.push(e)
            })
            return (
              <div key={s.key} style={{ position: 'relative', marginBottom: 14 }}>
                <div style={{
                  position: 'absolute', left: -21, top: 14, width: 16, height: 16,
                  borderRadius: '50%',
                  background: isEmpty ? 'var(--surface2)' : 'var(--accent)',
                  border: '2px solid var(--surface)', boxShadow: isEmpty ? 'none' : '0 0 0 2px rgba(99,102,241,0.15)',
                }} />
                <Card style={{ opacity: isEmpty ? 0.7 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{s.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                      {isEmpty ? '未着手' : `${stageEntries.length}件の記録`}
                    </div>
                    <div style={{ flex: 1 }} />
                    {!isEmpty && (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 10, padding: '2px 8px' }}
                        onClick={() => setExpandedStage(isExpanded ? null : s.key)}
                      >
                        {isExpanded ? '閉じる' : '詳細 ▸'}
                      </button>
                    )}
                    <button
                      className="btn btn-p btn-sm"
                      style={{ fontSize: 10, padding: '2px 10px' }}
                      onClick={() => { setFocusStage(s.key); setFocusAxis(''); setMode(isEmpty ? 'quick' : 'medium'); startSession() }}
                      disabled={loading}
                    >
                      {isEmpty ? '始める' : 'ここを掘る'}
                    </button>
                  </div>

                  {!isEmpty && (
                    <>
                      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                        {Array.from(byAxis.entries()).map(([axisKey, es]) => {
                          const axisLabel = AXES.find((a) => a.key === axisKey)?.label ?? axisKey
                          return (
                            <span
                              key={axisKey}
                              style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'var(--surface2)', color: 'var(--text2)' }}
                            >
                              {axisLabel}: {es.length}
                            </span>
                          )
                        })}
                      </div>

                      {!isExpanded && (
                        <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, marginTop: 10, fontStyle: 'italic' }}>
                          「{stageEntries[0].answer.substring(0, 90)}{stageEntries[0].answer.length > 90 ? '…' : ''}」
                        </div>
                      )}

                      {isExpanded && (
                        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {Array.from(byAxis.entries()).map(([axisKey, es]) => {
                            const axisLabel = AXES.find((a) => a.key === axisKey)?.label ?? axisKey
                            return (
                              <div key={axisKey}>
                                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>
                                  {axisLabel}
                                </div>
                                {es.map((e) => (
                                  <div key={e.id} style={{ marginBottom: 10, paddingLeft: 10, borderLeft: '2px solid var(--border)' }}>
                                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>Q: {e.question}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{e.answer}</div>
                                  </div>
                                ))}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </>
                  )}

                  {isEmpty && (
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                      この時期のことをまだ聞いていません
                    </div>
                  )}
                </Card>
              </div>
            )
          })}
        </div>
      </div>

      {/* Coverage heatmap — collapsed by default */}
      <div className="section" style={{ marginTop: 20 }}>
        <button
          onClick={() => setShowHeatmap((v) => !v)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase',
            letterSpacing: '.08em', padding: 0, marginBottom: 8,
          }}
        >
          {showHeatmap ? '▾' : '▸'} カバレッジマップ（ステージ × 軸の埋まり具合）
        </button>
        {showHeatmap && (
          <Card>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'separate', borderSpacing: 4, fontSize: 11 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0 8px 6px 0', color: 'var(--text3)', fontWeight: 400 }}></th>
                    {AXES.map((a) => (
                      <th key={a.key} style={{ textAlign: 'center', padding: '0 4px 6px', color: 'var(--text3)', fontWeight: 400, fontSize: 10 }}>{a.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {STAGES.map((s) => (
                    <tr key={s.key}>
                      <td style={{ padding: '2px 10px 2px 0', color: 'var(--text2)', whiteSpace: 'nowrap', fontSize: 10 }}>{s.label}</td>
                      {AXES.map((a) => {
                        const c = coverageCell.get(`${s.key}|${a.key}`)
                        return (
                          <td key={a.key}>
                            <div style={heatmapCellStyle(c)} title={`${c?.count ?? 0}件 / 深度${c?.maxDepth ?? 0}`}>
                              {c?.count ?? 0}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 10 }}>
              数字 = そのステージ × 軸で答えた件数。色が濃いほど深く聞けている。枠線付きは深度4以上。
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
