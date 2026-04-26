import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card, PageHeader } from '@/components/ui'
import { supabase } from '@/lib/supabase'

// Mode = 棚卸し対話の深さ（spec: 2択。「さっと」と「じっくり」のみ）
type Mode = 'quick' | 'medium'
const MODE_LIMITS: Record<Mode, number> = { quick: 5, medium: 12 }
const MODE_LABELS: Record<Mode, string> = {
  quick: '🌱 さっと（3〜5問で軽く）',
  medium: '🌳 じっくり（12問で深く掘る）',
}

// Fallback labels for entries that reference stages no longer in user_stages.
const PRESET_LABELS: Record<string, string> = {
  childhood: '幼少期',
  elementary: '小学生',
  junior_high: '中学生',
  high_school: '高校生',
  university: '大学',
  early_career: '社会人初期',
  mid_career: '社会人中期',
  recent: '最近',
}

// 誕生年が分かれば、preset ステージに年齢範囲を自動マップできる。
// custom ステージは year_start/year_end を直接持つ。
const PRESET_AGE_RANGES: Record<string, { start: number; end: number }> = {
  childhood:    { start: 0,  end: 6 },
  elementary:   { start: 6,  end: 12 },
  junior_high:  { start: 12, end: 15 },
  high_school:  { start: 15, end: 18 },
  university:   { start: 18, end: 22 },
  early_career: { start: 22, end: 27 },
  mid_career:   { start: 27, end: 37 },
  // recent は現在年基準（誕生年から算出）。後段で特別扱い。
}

const AXES = [
  { key: 'values', label: '価値観' },
  { key: 'family', label: '家庭' },
  { key: 'joy', label: '嬉しかった' },
  { key: 'struggle', label: '苦しかった' },
  { key: 'turning_point', label: '転機' },
  { key: 'career', label: '仕事' },
  { key: 'relationships', label: '人間関係' },
]

interface Stage {
  key: string
  label: string
  kind: 'preset' | 'custom'
  sort_order: number
  year_start?: number | null
  year_end?: number | null
  parent_key?: string | null
  entry_count?: number
}

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

interface SplitProposal {
  key: string
  label: string
  year_start: number | null
  year_end: number | null
  rationale: string
  entry_ids: number[]
}

interface SplitsResponse {
  should_split: boolean
  reason: string
  proposals: SplitProposal[]
  entry_count?: number
  total_chars?: number
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

  const [stages, setStages] = useState<Stage[]>([])
  const [coverage, setCoverage] = useState<CoverageCell[]>([])
  const [totalEntries, setTotalEntries] = useState(0)
  const [entries, setEntries] = useState<LifeEntry[]>([])
  const [expandedStage, setExpandedStage] = useState<string | null>(null)
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [birthYear, setBirthYear] = useState<number | null>(null)

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

  // Narrative ingest modal
  const [narrativeStageKey, setNarrativeStageKey] = useState<string | null>(null)
  const [narrativeText, setNarrativeText] = useState('')
  const [narrativeBusy, setNarrativeBusy] = useState(false)
  const [narrativeResult, setNarrativeResult] = useState<{ saved_count: number; warning?: string } | null>(null)

  // Split proposals modal
  const [splitStageKey, setSplitStageKey] = useState<string | null>(null)
  const [splitData, setSplitData] = useState<SplitsResponse | null>(null)
  const [splitBusy, setSplitBusy] = useState(false)
  const [splitChecked, setSplitChecked] = useState<Record<string, boolean>>({})

  const answerRef = useRef<HTMLTextAreaElement>(null)
  const narrativeRef = useRef<HTMLTextAreaElement>(null)

  const loadStages = useCallback(async () => {
    try {
      const res = await callLifeStory<{ stages: Stage[] }>({ action: 'list_stages' })
      setStages(res.stages ?? [])
    } catch (err) {
      console.error('[LifeHistory] list_stages failed', err)
    }
  }, [])

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

  const loadBirthYear = useCallback(async () => {
    const { data } = await supabase
      .from('user_settings')
      .select('birth_year')
      .maybeSingle()
    setBirthYear((data?.birth_year as number | null | undefined) ?? null)
  }, [])

  useEffect(() => { loadStages(); loadCoverage(); loadEntries(); loadBirthYear() }, [loadStages, loadCoverage, loadEntries, loadBirthYear])

  /** stage から「年齢範囲 / 西暦範囲」を導出。誕生年不明や recent 等は部分的に null を返す。 */
  const stageTimeRange = useCallback((s: Stage): { ageStart: number | null; ageEnd: number | null; yearStart: number | null; yearEnd: number | null } => {
    const now = new Date().getFullYear()

    // custom stage は year_start/end を優先
    let yearStart = s.year_start ?? null
    let yearEnd = s.year_end ?? null

    // preset の年齢マッピング（必要なら year を逆算）
    let ageStart: number | null = null
    let ageEnd: number | null = null

    const preset = PRESET_AGE_RANGES[s.key]
    if (preset) {
      ageStart = preset.start
      ageEnd = preset.end
      if (birthYear) {
        yearStart = yearStart ?? (birthYear + preset.start)
        yearEnd = yearEnd ?? (birthYear + preset.end)
      }
    } else if (s.key === 'recent') {
      yearStart = yearStart ?? (now - 3)
      yearEnd = yearEnd ?? now
      if (birthYear) {
        ageStart = yearStart - birthYear
        ageEnd = yearEnd - birthYear
      }
    } else if (birthYear && (yearStart || yearEnd)) {
      // custom stage: year から年齢を逆算
      if (yearStart) ageStart = yearStart - birthYear
      if (yearEnd) ageEnd = yearEnd - birthYear
    }
    return { ageStart, ageEnd, yearStart, yearEnd }
  }, [birthYear])

  const stageLabel = useCallback((key: string): string => {
    const s = stages.find((x) => x.key === key)
    if (s) return s.label
    return PRESET_LABELS[key] ?? key
  }, [stages])

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
      await Promise.all([loadStages(), loadCoverage(), loadEntries()])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [sessionId, loadStages, loadCoverage, loadEntries])

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

  // ── Narrative ingest ─────────────────────────────────────────
  const openNarrative = useCallback((stageKey: string) => {
    setNarrativeStageKey(stageKey)
    setNarrativeText('')
    setNarrativeResult(null)
    setTimeout(() => narrativeRef.current?.focus(), 50)
  }, [])

  const closeNarrative = useCallback(() => {
    setNarrativeStageKey(null)
    setNarrativeText('')
    setNarrativeResult(null)
  }, [])

  const submitNarrative = useCallback(async () => {
    if (!narrativeStageKey || narrativeText.trim().length < 10) return
    setNarrativeBusy(true)
    setError(null)
    try {
      const res = await callLifeStory<{ saved_count: number; warning?: string }>({
        action: 'ingest_narrative',
        stage_key: narrativeStageKey,
        narrative: narrativeText,
      })
      setNarrativeResult(res)
      await Promise.all([loadStages(), loadCoverage(), loadEntries()])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setNarrativeBusy(false)
    }
  }, [narrativeStageKey, narrativeText, loadStages, loadCoverage, loadEntries])

  // ── Split proposals ──────────────────────────────────────────
  const openSplit = useCallback(async (stageKey: string) => {
    setSplitStageKey(stageKey)
    setSplitData(null)
    setSplitChecked({})
    setSplitBusy(true)
    setError(null)
    try {
      const res = await callLifeStory<SplitsResponse>({ action: 'propose_splits', stage_key: stageKey })
      setSplitData(res)
      // Default: all proposals checked
      const initial: Record<string, boolean> = {}
      for (const p of res.proposals ?? []) initial[p.key] = true
      setSplitChecked(initial)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSplitBusy(false)
    }
  }, [])

  const closeSplit = useCallback(() => {
    setSplitStageKey(null)
    setSplitData(null)
    setSplitChecked({})
  }, [])

  const applySplit = useCallback(async () => {
    if (!splitStageKey || !splitData) return
    const selected = (splitData.proposals ?? []).filter((p) => splitChecked[p.key])
    if (selected.length === 0) return
    setSplitBusy(true)
    setError(null)
    try {
      const upserts = selected.map((p) => ({
        key: p.key,
        label: p.label,
        kind: 'custom' as const,
        year_start: p.year_start,
        year_end: p.year_end,
        parent_key: splitStageKey,
      }))
      const entryMigrations: Array<{ entry_id: number; new_stage_key: string }> = []
      for (const p of selected) {
        for (const id of p.entry_ids ?? []) {
          entryMigrations.push({ entry_id: id, new_stage_key: p.key })
        }
      }
      await callLifeStory({
        action: 'save_stages',
        upserts,
        entry_migrations: entryMigrations,
      })
      await Promise.all([loadStages(), loadCoverage(), loadEntries()])
      closeSplit()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSplitBusy(false)
    }
  }, [splitStageKey, splitData, splitChecked, loadStages, loadCoverage, loadEntries, closeSplit])

  // ── Derived state ────────────────────────────────────────────
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
    const bg = count === 0 ? 'var(--surface2)'
      : count <= 2 ? 'rgba(75, 120, 98, 0.18)'
      : count <= 5 ? 'rgba(75, 120, 98, 0.38)'
      : 'rgba(75, 120, 98, 0.62)'
    const text = count === 0 ? 'var(--text3)' : count >= 3 ? 'var(--text)' : 'var(--text2)'
    return {
      width: 32, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 10, color: text, background: bg,
      borderRadius: 4, fontFamily: 'var(--mono)',
      border: depth >= 4 ? '1px solid rgba(75, 120, 98, 0.6)' : '1px solid transparent',
    }
  }

  // ─── Render: Session active ─────────────────────────────────
  if (sessionActive && currentQ) {
    const total = MODE_LIMITS[mode]
    return (
      <div className="page">
        <PageHeader title={<>自分の<strong>ルーツ</strong></>} description={`${questionCount + 1} / ${total}問目`} />

        <Card>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--accent2)', padding: '2px 8px', background: 'rgba(75, 120, 98,0.12)', borderRadius: 12 }}>
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
        <PageHeader title={<>自分の<strong>ルーツ</strong></>} description={`セッション完了 — ${summary.total_entries}件の回答を整理しました`} />

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
                const axisLabel = AXES.find((a) => a.key === d.axis)?.label ?? d.axis
                return (
                  <Card key={i}>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>
                      {stageLabel(d.stage)} · {axisLabel}
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
        title={<>自分の<strong>ルーツ</strong></>}
        description="いま、ここに至った道のりを、ゆっくり眺める。"
      />

      <Card>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
          モードを選んで始めると、AIが過去の回答を踏まえて質問を選びます。自然文で書きたい場合は、下のタイムラインから各時期の「自然文で書く」ボタンを使ってください。
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {(['quick', 'medium'] as Mode[]).map((m) => (
            <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: `1px solid ${mode === m ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 6, cursor: 'pointer', background: mode === m ? 'rgba(75, 120, 98,0.08)' : 'transparent' }}>
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
              {stages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
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
        {!birthYear && (
          <Card style={{ marginBottom: 12, background: 'rgba(75, 120, 98,0.06)', border: '1px dashed var(--accent)' }}>
            <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }}>
              誕生年を設定すると、各時期の<strong>西暦と年齢</strong>が自動で表示されます。
              <a href="/profile" style={{ color: 'var(--accent)', marginLeft: 6, textDecoration: 'underline' }}>基本情報で設定する →</a>
            </div>
          </Card>
        )}
        <div style={{ position: 'relative', paddingLeft: 24 }}>
          <div style={{ position: 'absolute', left: 7, top: 8, bottom: 8, width: 2, background: 'var(--border)' }} />
          {stages.map((s) => {
            const stageEntries = entriesByStage.get(s.key) ?? []
            const isExpanded = expandedStage === s.key
            const isEmpty = stageEntries.length === 0
            const byAxis = new Map<string, LifeEntry[]>()
            stageEntries.forEach((e) => {
              if (!byAxis.has(e.axis)) byAxis.set(e.axis, [])
              byAxis.get(e.axis)!.push(e)
            })
            const isCustom = s.kind === 'custom'
            const canPropose = stageEntries.length >= 5
            const { ageStart, ageEnd, yearStart, yearEnd } = stageTimeRange(s)
            const yearText = formatRange(yearStart, yearEnd)
            const ageText = formatRange(ageStart, ageEnd, '歳')
            return (
              <div key={s.key} style={{ position: 'relative', marginBottom: 14, marginLeft: isCustom ? 16 : 0 }}>
                <div style={{
                  position: 'absolute', left: -21 - (isCustom ? 16 : 0), top: 22, width: 16, height: 16,
                  borderRadius: '50%',
                  background: isEmpty ? 'var(--surface2)' : (isCustom ? 'var(--accent2)' : 'var(--accent)'),
                  border: '2px solid var(--surface)', boxShadow: isEmpty ? 'none' : '0 0 0 2px rgba(75, 120, 98,0.15)',
                }} />
                <Card style={{ opacity: isEmpty ? 0.5 : 1 }}>
                  {/* 時系列メタ: 年号 + 年齢 + ラベル */}
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 10 }}>
                    <div style={{ minWidth: 120 }}>
                      <div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--mono)', color: yearText ? 'var(--text)' : 'var(--text3)', letterSpacing: '-.01em', lineHeight: 1.1 }}>
                        {yearText ?? '—'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: 2 }}>
                        {ageText ?? (birthYear ? '' : '誕生年未設定')}
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{s.label}</div>
                        {isCustom && (
                          <span style={{ fontSize: 9, padding: '1px 6px', background: 'rgba(16,185,129,0.15)', color: 'var(--accent2)', borderRadius: 8, textTransform: 'uppercase', letterSpacing: '.08em' }}>custom</span>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: 2 }}>
                        {isEmpty ? '未着手' : `${stageEntries.length}件の記録`}
                      </div>
                    </div>
                  </div>
                  {/* 操作ボタン（折り返し対応） */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
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
                      className="btn btn-g btn-sm"
                      style={{ fontSize: 10, padding: '2px 10px' }}
                      onClick={() => openNarrative(s.key)}
                      disabled={loading}
                      title="この時期のことを長文で書き起こす。AIが軸別に整理して保存します"
                    >
                      自然文で書く
                    </button>
                    {canPropose && (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 10, padding: '2px 8px' }}
                        onClick={() => openSplit(s.key)}
                        disabled={loading}
                        title="情報が溜まってきたので、より細かい時期（1社目/何年目等）に分割できないかAIに提案させる"
                      >
                        細かく分ける
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
                  {stages.map((s) => (
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

      {/* ─── Modal: Narrative ingest ─────────────────────────── */}
      {narrativeStageKey && (
        <Overlay onClose={narrativeBusy ? undefined : closeNarrative}>
          <div style={{ width: 'min(640px, 92vw)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text3)', marginBottom: 4 }}>
              {stageLabel(narrativeStageKey)} に書き起こす
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>
              この時期のことを自由に書いてください
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10, lineHeight: 1.6 }}>
              覚えていること・感じていたこと・周りの人・場所・出来事など、思い出す順で。<br />
              AIが軸別（価値観・家庭・嬉しかった・苦しかった・転機・仕事・人間関係）に整理して保存します。
            </div>
            {!narrativeResult ? (
              <>
                <textarea
                  ref={narrativeRef}
                  value={narrativeText}
                  onChange={(e) => setNarrativeText(e.target.value)}
                  placeholder="例: 小学校3年生のとき、引っ越しで転校した。新しいクラスで最初は話しかけられず、放課後は一人で図書館にいた。そこで出会った本に救われた感覚があって、今でも本屋が落ち着く場所になっている。家では父が単身赴任していて…"
                  rows={14}
                  disabled={narrativeBusy}
                  style={{
                    width: '100%', padding: 12, fontSize: 13, lineHeight: 1.7,
                    border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)',
                    color: 'var(--text)', resize: 'vertical', fontFamily: 'inherit',
                  }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
                  <button
                    className="btn btn-p btn-sm"
                    onClick={submitNarrative}
                    disabled={narrativeBusy || narrativeText.trim().length < 10}
                  >
                    {narrativeBusy ? 'AIが読み解いています…' : 'AIに整理してもらう'}
                  </button>
                  <button className="btn btn-g btn-sm" onClick={closeNarrative} disabled={narrativeBusy}>
                    キャンセル
                  </button>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                    {narrativeText.length}字
                  </span>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 10 }}>
                  {narrativeResult.saved_count > 0
                    ? `${narrativeResult.saved_count} 件のエントリを保存しました。`
                    : (narrativeResult.warning ?? '保存できる内容が抽出できませんでした。')}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-p btn-sm" onClick={closeNarrative}>閉じる</button>
                  <button className="btn btn-g btn-sm" onClick={() => setNarrativeResult(null)}>もう一度書く</button>
                </div>
              </>
            )}
            {error && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 10 }}>{error}</div>}
          </div>
        </Overlay>
      )}

      {/* ─── Modal: Split proposals ──────────────────────────── */}
      {splitStageKey && (
        <Overlay onClose={splitBusy ? undefined : closeSplit}>
          <div style={{ width: 'min(680px, 92vw)', maxHeight: '88vh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text3)', marginBottom: 4 }}>
              {stageLabel(splitStageKey)} を分割
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>
              この時期をより細かく分けられるかAIが検討します
            </div>

            {splitBusy && !splitData && (
              <div style={{ fontSize: 12, color: 'var(--text2)', padding: '24px 0', textAlign: 'center' }}>
                AIが既存の記録を読んで、分割案を考えています…
              </div>
            )}

            {splitData && !splitData.should_split && (
              <>
                <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 8 }}>
                  分割は保留にしました。
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 14 }}>
                  {splitData.reason}
                </div>
                <button className="btn btn-p btn-sm" onClick={closeSplit}>閉じる</button>
              </>
            )}

            {splitData && splitData.should_split && (
              <>
                <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 12 }}>
                  {splitData.reason}
                </div>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text3)', marginBottom: 8 }}>
                  採用する分割（チェックを外すと保存されません）
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                  {splitData.proposals.map((p) => (
                    <label
                      key={p.key}
                      style={{
                        display: 'flex', gap: 10, padding: 12,
                        border: `1px solid ${splitChecked[p.key] ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: 8, cursor: 'pointer',
                        background: splitChecked[p.key] ? 'rgba(75, 120, 98,0.05)' : 'transparent',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!!splitChecked[p.key]}
                        onChange={(e) => setSplitChecked((prev) => ({ ...prev, [p.key]: e.target.checked }))}
                        style={{ marginTop: 2 }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 4 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{p.label}</div>
                          {(p.year_start || p.year_end) && (
                            <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                              {p.year_start ?? '?'}–{p.year_end ?? '?'}
                            </div>
                          )}
                          <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                            {p.entry_ids?.length ?? 0}件を移動
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5 }}>
                          {p.rationale}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-p btn-sm"
                    onClick={applySplit}
                    disabled={splitBusy || Object.values(splitChecked).every((v) => !v)}
                  >
                    {splitBusy ? '保存中…' : '採用した分割を保存'}
                  </button>
                  <button className="btn btn-g btn-sm" onClick={closeSplit} disabled={splitBusy}>
                    キャンセル
                  </button>
                </div>
              </>
            )}

            {error && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 10 }}>{error}</div>}
          </div>
        </Overlay>
      )}
    </div>
  )
}

/** 年齢・年号レンジを "A–B" / "A–" / "–B" / null で表示する。suffix を付けると "A–B歳" 等。 */
function formatRange(start: number | null | undefined, end: number | null | undefined, suffix = ''): string | null {
  const s = start ?? null
  const e = end ?? null
  if (s == null && e == null) return null
  if (s != null && e != null) return s === e ? `${s}${suffix}` : `${s}–${e}${suffix}`
  if (s != null) return `${s}${suffix}〜`
  return `〜${e}${suffix}`
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}
    >
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  )
}
