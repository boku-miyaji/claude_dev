import { useEffect, useMemo, useState } from 'react'
import { Card, PageHeader, EmptyState } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import {
  adoptSuggestion,
  checkSuggestion,
  dismissSuggestion,
  markImplemented,
  rejectSuggestion,
} from '@/lib/intelligenceSuggestions'
import type {
  IntelligenceSuggestion,
  SuggestionPriority,
  SuggestionStatus,
} from '@/types/intelligence'

// ============================================================
// Types (existing Overview sections)
// ============================================================

interface HourCount { hour: number; count: number }
interface DowCount { dow: number; dow_label: string; count: number }
interface DiaryRhythmStats {
  total_entries: number; peak_hour: number; peak_dow: number
  peak_dow_label: string; late_night_pct: number; weekend_pct: number
  streak_current: number; streak_max: number
}
interface DiaryRhythmSuggestion { type: 'positive' | 'neutral' | 'warning'; text: string }
interface DiaryRhythmData {
  hourly: HourCount[]; daily: DowCount[]
  stats: DiaryRhythmStats; suggestions: DiaryRhythmSuggestion[]
}

interface Insight {
  id: number; category: string; insight: string
  evidence?: string; confidence: string; company_id?: string
  companies?: { name: string }; created_at: string
}

// ============================================================
// Constants
// ============================================================

const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土']

const CAT_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  // Diary-based (product)
  mood_cycle: { label: '気分の波', icon: '〜', color: 'var(--accent2)' },
  trigger: { label: 'トリガー', icon: '⚡', color: 'var(--amber)' },
  correlation: { label: '相関', icon: '↔', color: 'var(--blue)' },
  disconnect: { label: 'ズレ', icon: '≠', color: 'var(--red)' },
  value: { label: '大事にしてること', icon: '♦', color: 'var(--green)' },
  drift: { label: '変化', icon: '↗', color: 'var(--accent)' },
  fading: { label: '消えたテーマ', icon: '…', color: 'var(--text3)' },
  focus: { label: '今の関心', icon: '◎', color: 'var(--accent2)' },
  recurring: { label: '繰り返し気にしてる', icon: '↻', color: 'var(--amber)' },
  shift: { label: '関心の変化', icon: '→', color: 'var(--blue)' },
  blind_spot: { label: '盲点', icon: '?', color: 'var(--red)' },
  // CLI-only
  pattern: { label: 'パターン', icon: '◎', color: 'var(--accent2)' },
  preference: { label: '好み', icon: '♡', color: 'var(--green)' },
  strength: { label: '得意分野', icon: '★', color: 'var(--amber)' },
  tendency: { label: '傾向', icon: '→', color: 'var(--blue)' },
  feedback: { label: 'フィードバック', icon: '↩', color: 'var(--red)' },
  work_rhythm: { label: '稼働リズム', icon: '⏰', color: 'var(--accent)' },
}

const CLI_CATEGORIES = new Set(['pattern', 'preference', 'strength', 'tendency', 'feedback', 'work_rhythm'])
const CONF_COLORS: Record<string, string> = { high: 'var(--green)', medium: 'var(--amber)', low: 'var(--text3)' }
const SUG_COLORS: Record<string, string> = { positive: 'var(--green)', neutral: 'var(--accent2)', warning: 'var(--amber)' }

// ============================================================
// Sub-components (shared by Overview)
// ============================================================

function RhythmBar({ counts, max, labels, colorFn, height = 60 }: {
  counts: number[]; max: number; labels: string[]
  colorFn: (i: number) => string; height?: number
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height }}>
        {counts.map((c, i) => {
          const pct = Math.round((c / max) * 100)
          return (
            <div key={i} title={`${labels[i]} — ${c}件`} style={{
              flex: 1, minWidth: 0, background: colorFn(i),
              opacity: pct > 0 ? Math.max(0.3, pct / 100) : 0.05,
              height: `${Math.max(2, pct)}%`,
              borderRadius: '2px 2px 0 0', cursor: 'default',
            }} />
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 2, fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
        {labels.map((l, i) => (
          <div key={i} style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>{l}</div>
        ))}
      </div>
    </div>
  )
}

function SuggestionBox({ items, colorMap }: {
  items: { type?: string; color?: string; text: string }[]
  colorMap?: Record<string, string>
}) {
  if (items.length === 0) return null
  return (
    <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--bg2)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.5px' }}>示唆</div>
      {items.map((s, i) => (
        <div key={i} style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ width: 6, height: 6, minWidth: 6, borderRadius: '50%', background: s.color || (colorMap?.[s.type || ''] ?? 'var(--text3)'), display: 'inline-block' }} />
          <span>{s.text}</span>
        </div>
      ))}
    </div>
  )
}

// ============================================================
// Work Rhythm (CLI-only, from prompt_log)
// ============================================================

function WorkRhythmSection() {
  const [hourCounts, setHourCounts] = useState<number[]>([])
  const [dowCounts, setDowCounts] = useState<number[]>([])
  const [total, setTotal] = useState(0)

  useEffect(() => {
    supabase.from('prompt_log').select('created_at').then(({ data }) => {
      if (!data || data.length < 5) return
      const h = new Array(24).fill(0)
      const d = new Array(7).fill(0)
      for (const l of data) {
        const dt = new Date(l.created_at)
        h[(dt.getUTCHours() + 9) % 24]++
        d[new Date(dt.getTime() + 9 * 60 * 60 * 1000).getDay()]++
      }
      setHourCounts(h); setDowCounts(d); setTotal(data.length)
    })
  }, [])

  if (total < 5) return null

  const maxH = Math.max(...hourCounts) || 1
  const maxD = Math.max(...dowCounts) || 1
  const peakH = hourCounts.indexOf(maxH)
  const peakD = dowCounts.indexOf(maxD)
  const lateNight = hourCounts.slice(22).reduce((a, b) => a + b, 0) + hourCounts.slice(0, 6).reduce((a, b) => a + b, 0)
  const lateRate = Math.round((lateNight / total) * 100)
  const weekendTotal = dowCounts[0] + dowCounts[6]
  const weekendRate = Math.round((weekendTotal / total) * 100)

  // Generate insights
  const insights: { color: string; text: string }[] = []
  if (lateRate > 40) insights.push({ color: 'var(--red)', text: `深夜帯の作業が全体の${lateRate}%。睡眠への影響が懸念される水準` })
  else if (lateRate > 20) insights.push({ color: 'var(--amber)', text: `深夜帯の作業が${lateRate}%。慢性化すると判断力が鈍りやすい` })

  if (weekendRate > 30) insights.push({ color: 'var(--red)', text: `土日の稼働が全体の${weekendRate}%。オン/オフの境界が曖昧になっている可能性` })
  else if (weekendRate > 15) insights.push({ color: 'var(--amber)', text: `週末にも${weekendRate}%の稼働あり。意図的な作業か惰性か、振り返る価値あり` })

  if (peakH >= 22 || peakH <= 4) insights.push({ color: 'var(--red)', text: `夜型のリズム。ピークが${peakH}時台。生活リズムの見直しを検討` })
  else if (peakH >= 5 && peakH <= 9) insights.push({ color: 'var(--green)', text: '朝型のリズム。午前中にピークが来ており、集中力の高い時間を活用できている' })

  const minDow = dowCounts.indexOf(Math.min(...dowCounts))
  if (maxD > 0 && dowCounts[minDow] / maxD < 0.2 && minDow >= 1 && minDow <= 5) {
    insights.push({ color: 'var(--text3)', text: `${DOW_LABELS[minDow]}曜日の稼働が極端に少ない（${dowCounts[minDow]}件）。MTG集中日 or 意図的なオフ？` })
  }

  // Weekend work insight
  if (weekendRate < 5 && total >= 20) {
    insights.push({ color: 'var(--green)', text: '週末はほぼ稼働なし。オン/オフの切り替えが明確' })
  }

  // Concentration vs spread (CV calculation)
  const activeDays = dowCounts.filter((c) => c > 0).length
  const dowMean = total / 7
  const dowVariance = dowCounts.reduce((sum, c) => sum + Math.pow(c - dowMean, 2), 0) / 7
  const dowStdDev = Math.sqrt(dowVariance)
  const dowCv = dowMean > 0 ? dowStdDev / dowMean : 0

  if (activeDays <= 3 && total >= 20) {
    insights.push({ color: 'var(--accent2)', text: `稼働が週${activeDays}日に集中。短期集中型` })
  } else if (dowCv < 0.3 && total >= 20) {
    insights.push({ color: 'var(--blue)', text: '曜日ごとの稼働量が均一' })
  } else if (dowCv > 0.7 && total >= 20) {
    insights.push({ color: 'var(--amber)', text: '曜日による稼働のばらつきが大きい' })
  }

  // Peak hour insight (13-15 range, only if not already added)
  const hasPeakHourInsight = insights.some((i) => i.text.includes('ピーク'))
  if (!hasPeakHourInsight && peakH >= 13 && peakH <= 15) {
    insights.push({ color: 'var(--accent)', text: '午後にピーク。午前はMTGや情報収集、午後に集中作業というパターンか' })
  }

  const hourLabels = Array.from({ length: 24 }, (_, i) => i % 3 === 0 ? String(i) : '')

  return (
    <>
      <div className="section-title">稼働リズム</div>
      <Card>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text2)' }}>時間帯別アクティビティ</div>
        <RhythmBar counts={hourCounts} max={maxH} labels={hourLabels}
          colorFn={(i) => (i >= 22 || i < 6) ? 'var(--red)' : 'var(--accent)'} />

        <div style={{ fontSize: 12, fontWeight: 600, margin: '20px 0 8px', color: 'var(--text2)' }}>曜日別アクティビティ</div>
        <RhythmBar counts={dowCounts} max={maxD} labels={DOW_LABELS} height={40}
          colorFn={(i) => (i === 0 || i === 6) ? 'var(--amber)' : 'var(--accent)'} />

        <div style={{ display: 'flex', gap: 24, marginTop: 16, fontSize: 12, color: 'var(--text2)' }}>
          <span><span style={{ color: 'var(--text3)' }}>ピーク時間: </span><b>{peakH}:00</b></span>
          <span><span style={{ color: 'var(--text3)' }}>最活発曜日: </span><b>{DOW_LABELS[peakD]}</b></span>
          <span><span style={{ color: 'var(--text3)' }}>深夜率: </span><b style={{ color: lateRate > 20 ? 'var(--red)' : undefined }}>{lateRate}%</b></span>
        </div>

        <SuggestionBox items={insights} />
      </Card>
    </>
  )
}

// ============================================================
// Diary Rhythm (Product, from Edge Function)
// ============================================================

function DiaryRhythmSection() {
  const [data, setData] = useState<DiaryRhythmData | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token || ''
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/diary-rhythm?days=30`
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
        })
        if (res.ok) {
          const d = await res.json()
          if (d.hourly && d.stats?.total_entries >= 3) setData(d)
          else console.warn('[diary-rhythm] insufficient data:', d)
        } else {
          console.warn('[diary-rhythm] HTTP error:', res.status)
        }
      } catch (e) {
        console.warn('[diary-rhythm] fetch failed:', e)
      }
    })()
  }, [])

  if (!data) return null

  const { hourly, daily, stats: s, suggestions } = data
  const maxH = Math.max(...hourly.map((h) => h.count)) || 1
  const maxD = Math.max(...daily.map((d) => d.count)) || 1
  const hourCounts = hourly.map((h) => h.count)
  const dowCounts = daily.map((d) => d.count)
  const hourLabels = Array.from({ length: 24 }, (_, i) => i % 3 === 0 ? String(i) : '')

  return (
    <>
      <div className="section-title">日記リズム</div>
      <Card>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text2)' }}>時間帯別</div>
        <RhythmBar counts={hourCounts} max={maxH} labels={hourLabels} height={50}
          colorFn={(i) => (i >= 22 || i < 6) ? 'var(--accent2)' : 'var(--green)'} />

        <div style={{ fontSize: 12, fontWeight: 600, margin: '20px 0 8px', color: 'var(--text2)' }}>曜日別</div>
        <RhythmBar counts={dowCounts} max={maxD} labels={DOW_LABELS} height={35}
          colorFn={(i) => (i === 0 || i === 6) ? 'var(--accent2)' : 'var(--green)'} />

        <div style={{ display: 'flex', gap: 16, marginTop: 16, fontSize: 12, color: 'var(--text2)', flexWrap: 'wrap' }}>
          <span><span style={{ color: 'var(--text3)' }}>記入ピーク: </span><b>{s.peak_hour}:00</b></span>
          <span><span style={{ color: 'var(--text3)' }}>最多曜日: </span><b>{s.peak_dow_label}</b></span>
          <span><span style={{ color: 'var(--text3)' }}>連続: </span><b style={{ color: s.streak_current >= 3 ? 'var(--green)' : undefined }}>{s.streak_current}日</b></span>
          <span><span style={{ color: 'var(--text3)' }}>最長: </span><b>{s.streak_max}日</b></span>
        </div>

        <SuggestionBox items={suggestions} colorMap={SUG_COLORS} />
      </Card>
    </>
  )
}

// ============================================================
// Insight Cards (grouped by category)
// ============================================================

function InsightCards({ insights, isCliMode }: { insights: Insight[]; isCliMode: boolean }) {
  const grouped: Record<string, Insight[]> = {}
  for (const i of insights) {
    if (!isCliMode && CLI_CATEGORIES.has(i.category)) continue
    if (!grouped[i.category]) grouped[i.category] = []
    grouped[i.category].push(i)
  }

  const highCount = insights.filter((i) => i.confidence === 'high').length
  const catCount = Object.keys(grouped).length

  return (
    <>
      <div className="g4" style={{ marginBottom: 24 }}>
        <div className="card kpi"><div className="kpi-val">{insights.length}</div><div className="kpi-lbl">Total Insights</div></div>
        <div className="card kpi"><div className="kpi-val good">{highCount}</div><div className="kpi-lbl">High Confidence</div></div>
        <div className="card kpi"><div className="kpi-val">{catCount}</div><div className="kpi-lbl">Categories</div></div>
      </div>

      {Object.entries(CAT_CONFIG).map(([cat, cfg]) => {
        const items = grouped[cat]
        if (!items || items.length === 0) return null
        return (
          <div key={cat}>
            <div className="section-title">{cfg.icon} {cfg.label} ({items.length})</div>
            <Card style={{ marginBottom: 20 }}>
              {items.map((item) => (
                <div key={item.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: CONF_COLORS[item.confidence] || 'var(--text3)', flexShrink: 0 }} />
                    <span style={{ fontWeight: 500, fontSize: 13, flex: 1 }}>{item.insight}</span>
                    <span className="tag tag-co">{item.companies?.name || '全社'}</span>
                  </div>
                  {item.evidence && (
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 16, marginTop: 2 }}>
                      {item.evidence.substring(0, 120)}
                    </div>
                  )}
                </div>
              ))}
            </Card>
          </div>
        )
      })}
    </>
  )
}

// ============================================================
// Overview Tab (wraps all existing sections)
// ============================================================

function OverviewTab() {
  const [insights, setInsights] = useState<Insight[]>([])
  const [isCliMode, setIsCliMode] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('ceo_insights').select('*,companies(name)').order('created_at', { ascending: false }),
      supabase.from('claude_settings').select('id').limit(1),
    ]).then(([insRes, cliRes]) => {
      setInsights(insRes.data || [])
      setIsCliMode(Boolean(cliRes.data && cliRes.data.length > 0))
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="skeleton-card" style={{ height: 200 }} />

  return (
    <>
      <DiaryRhythmSection />
      {isCliMode && <WorkRhythmSection />}

      {insights.length === 0
        ? <EmptyState icon="📊" message="インサイトはまだありません。日記を書き続けると自動で分析が始まります。" />
        : <InsightCards insights={insights} isCliMode={isCliMode} />
      }
    </>
  )
}

// ============================================================
// Suggestions Tab (intelligence_suggestions)
// ============================================================

const PRIORITY_COLORS: Record<SuggestionPriority, string> = {
  high: 'var(--red)',
  medium: 'var(--amber)',
  low: 'var(--text3)',
}

const STATUS_LABELS: Record<SuggestionStatus, string> = {
  new: '未チェック',
  checked: 'チェック済',
  adopted: '採用',
  rejected: '却下',
  implemented: '実装済',
  dismissed: 'スキップ',
}

const STATUS_COLORS: Record<SuggestionStatus, string> = {
  new: 'var(--accent2)',
  checked: 'var(--blue)',
  adopted: 'var(--green)',
  rejected: 'var(--text3)',
  implemented: 'var(--accent)',
  dismissed: 'var(--text3)',
}

const ACTIVE_STATUSES: SuggestionStatus[] = ['new', 'checked']

function SuggestionsTab() {
  const [all, setAll] = useState<IntelligenceSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  // filters
  const [priorityFilter, setPriorityFilter] = useState<Set<SuggestionPriority>>(new Set())
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<Set<SuggestionStatus>>(new Set())

  const load = async () => {
    const { data } = await supabase
      .from('intelligence_suggestions')
      .select('*')
      .order('source_report_date', { ascending: false })
    setAll((data as IntelligenceSuggestion[]) || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const s of all) if (s.category) set.add(s.category)
    return Array.from(set).sort()
  }, [all])

  const visible = useMemo(() => {
    return all.filter((s) => {
      if (!showArchived && !ACTIVE_STATUSES.includes(s.status)) return false
      if (priorityFilter.size > 0 && (!s.priority || !priorityFilter.has(s.priority))) return false
      if (categoryFilter.size > 0 && (!s.category || !categoryFilter.has(s.category))) return false
      if (statusFilter.size > 0 && !statusFilter.has(s.status)) return false
      return true
    })
  }, [all, showArchived, priorityFilter, categoryFilter, statusFilter])

  const counts = useMemo(() => {
    const c: Record<SuggestionStatus, number> = {
      new: 0, checked: 0, adopted: 0, rejected: 0, implemented: 0, dismissed: 0,
    }
    for (const s of all) c[s.status]++
    return c
  }, [all])

  async function doAction(
    id: string,
    action: (id: string) => Promise<unknown>,
    errorLabel: string,
  ) {
    setBusyId(id)
    try {
      await action(id)
      await load()
    } catch (e) {
      console.error(`[SuggestionsTab] ${errorLabel} failed:`, e)
      alert(`${errorLabel}に失敗しました: ${(e as Error).message || e}`)
    } finally {
      setBusyId(null)
    }
  }

  function togglePriority(p: SuggestionPriority) {
    setPriorityFilter((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p); else next.add(p)
      return next
    })
  }
  function toggleCategory(c: string) {
    setCategoryFilter((prev) => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c); else next.add(c)
      return next
    })
  }
  function toggleStatus(s: SuggestionStatus) {
    setStatusFilter((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s); else next.add(s)
      return next
    })
  }

  if (loading) return <div className="skeleton-card" style={{ height: 200 }} />

  if (all.length === 0) {
    return <EmptyState icon="💡" message="示唆はまだありません。情報収集部のレポートから自動で収集されます。" />
  }

  return (
    <div>
      {/* Status summary */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, fontSize: 12, flexWrap: 'wrap' }}>
        {(['new', 'checked', 'adopted', 'rejected', 'implemented', 'dismissed'] as const).map((st) => (
          <span key={st} style={{ color: 'var(--text3)' }}>
            <b style={{ color: STATUS_COLORS[st] }}>{counts[st]}</b> {STATUS_LABELS[st]}
          </span>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: 12, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <FilterGroup label="優先度">
          {(['high', 'medium', 'low'] as const).map((p) => (
            <FilterChip
              key={p}
              active={priorityFilter.has(p)}
              onClick={() => togglePriority(p)}
              color={PRIORITY_COLORS[p]}
            >
              {p}
            </FilterChip>
          ))}
        </FilterGroup>

        {categories.length > 0 && (
          <FilterGroup label="カテゴリ">
            {categories.map((c) => (
              <FilterChip
                key={c}
                active={categoryFilter.has(c)}
                onClick={() => toggleCategory(c)}
              >
                {c}
              </FilterChip>
            ))}
          </FilterGroup>
        )}

        <FilterGroup label="状態">
          {(['new', 'checked', 'adopted', 'rejected', 'implemented', 'dismissed'] as const).map((s) => (
            <FilterChip
              key={s}
              active={statusFilter.has(s)}
              onClick={() => toggleStatus(s)}
              color={STATUS_COLORS[s]}
            >
              {STATUS_LABELS[s]}
            </FilterChip>
          ))}
        </FilterGroup>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{visible.length} / {all.length} 件</span>
          <label style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            完了・却下・スキップも表示
          </label>
        </div>
      </div>

      {/* Cards */}
      {visible.length === 0 ? (
        <EmptyState icon="🔍" message="条件に合う示唆がありません" />
      ) : (
        visible.map((s) => (
          <SuggestionCard
            key={s.id}
            suggestion={s}
            busy={busyId === s.id}
            onCheck={() => doAction(s.id, checkSuggestion, 'チェック')}
            onDismiss={() => doAction(s.id, dismissSuggestion, '削除')}
            onAdopt={() => doAction(s.id, adoptSuggestion, '採用')}
            onReject={() => doAction(s.id, rejectSuggestion, '却下')}
            onImplemented={() => doAction(s.id, markImplemented, '実装済み')}
          />
        ))
      )}
    </div>
  )
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.5px', minWidth: 52 }}>
        {label}
      </span>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{children}</div>
    </div>
  )
}

function FilterChip({ active, onClick, color, children }: {
  active: boolean
  onClick: () => void
  color?: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 11,
        padding: '3px 10px',
        borderRadius: 12,
        border: `1px solid ${active ? (color || 'var(--accent)') : 'var(--border)'}`,
        background: active ? (color || 'var(--accent)') + '22' : 'var(--surface)',
        color: active ? (color || 'var(--accent)') : 'var(--text2)',
        cursor: 'pointer',
        fontWeight: active ? 600 : 400,
        fontFamily: 'var(--font)',
      }}
    >
      {children}
    </button>
  )
}

function SuggestionCard({
  suggestion: s,
  busy,
  onCheck,
  onDismiss,
  onAdopt,
  onReject,
  onImplemented,
}: {
  suggestion: IntelligenceSuggestion
  busy: boolean
  onCheck: () => void
  onDismiss: () => void
  onAdopt: () => void
  onReject: () => void
  onImplemented: () => void
}) {
  const reportDate = s.source_report_date
    ? new Date(s.source_report_date).toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' })
    : null

  return (
    <div className="card" style={{ marginBottom: 12, padding: 14, opacity: busy ? 0.6 : 1 }}>
      {/* Header: title + status */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
        <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>
          {s.title}
        </div>
        <span style={{
          fontSize: 10, padding: '2px 8px', borderRadius: 10,
          background: STATUS_COLORS[s.status] + '22',
          color: STATUS_COLORS[s.status],
          fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          {STATUS_LABELS[s.status]}
        </span>
      </div>

      {/* Description */}
      {s.description && (
        <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 10 }}>
          {s.description}
        </div>
      )}

      {/* Metadata row: priority / effort / category / date */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        {s.priority && (
          <span style={{
            fontSize: 10, padding: '1px 7px', borderRadius: 3,
            background: PRIORITY_COLORS[s.priority] + '22',
            color: PRIORITY_COLORS[s.priority], fontWeight: 600,
          }}>
            {s.priority}
          </span>
        )}
        {s.effort && (
          <span style={{
            fontSize: 10, padding: '1px 7px', borderRadius: 3,
            background: 'var(--surface2)', color: 'var(--text3)',
          }}>
            effort: {s.effort}
          </span>
        )}
        {s.category && (
          <span style={{
            fontSize: 10, padding: '1px 7px', borderRadius: 3,
            background: 'var(--accent-bg, var(--surface2))', color: 'var(--accent2)',
          }}>
            {s.category}
          </span>
        )}
        {reportDate && (
          <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
            {reportDate}
          </span>
        )}
        {s.task_id !== null && (
          <a
            href={`#/tasks?id=${s.task_id}`}
            style={{ fontSize: 10, color: 'var(--accent)', textDecoration: 'none' }}
            onClick={(e) => { e.preventDefault(); window.location.hash = `#/tasks?id=${s.task_id}` }}
          >
            → タスク #{s.task_id}
          </a>
        )}
      </div>

      {/* Source URLs */}
      {s.source_urls && s.source_urls.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, fontSize: 11 }}>
          {s.source_urls.map((url, i) => (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--accent)', textDecoration: 'none' }}
            >
              {shortenUrl(url)} ↗
            </a>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {s.status === 'new' && (
          <>
            <button className="btn btn-g btn-sm" onClick={onDismiss} disabled={busy}>削除</button>
            <button className="btn btn-p btn-sm" onClick={onCheck} disabled={busy}>チェック</button>
          </>
        )}
        {s.status === 'checked' && (
          <>
            <button className="btn btn-g btn-sm" onClick={onReject} disabled={busy}>却下</button>
            <button className="btn btn-p btn-sm" onClick={onAdopt} disabled={busy}>採用</button>
          </>
        )}
        {s.status === 'adopted' && (
          <button className="btn btn-p btn-sm" onClick={onImplemented} disabled={busy}>実装済みにする</button>
        )}
      </div>
    </div>
  )
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    const path = u.pathname.length > 1 ? u.pathname : ''
    const combined = `${host}${path}`
    return combined.length > 50 ? combined.substring(0, 50) + '...' : combined
  } catch {
    return url.length > 50 ? url.substring(0, 50) + '...' : url
  }
}

// ============================================================
// Main Page
// ============================================================

type Tab = 'overview' | 'suggestions'

export function Insights() {
  const initialTab: Tab = window.location.hash === '#suggestions' ? 'suggestions' : 'overview'
  const [tab, setTab] = useState<Tab>(initialTab)

  const handleTabChange = (next: Tab) => {
    setTab(next)
    window.location.hash = next === 'suggestions' ? '#suggestions' : ''
  }

  return (
    <div className="page">
      <PageHeader title="Insights" description="あなたの行動パターン・傾向" />

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--border)', paddingBottom: 0 }}>
        {([['overview', 'Overview'], ['suggestions', 'Suggestions']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => handleTabChange(id)}
            style={{
              background: 'none', border: 'none', padding: '10px 20px', fontSize: 13,
              fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)',
              color: tab === id ? 'var(--accent)' : 'var(--text3)',
              borderBottom: tab === id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -2,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? <OverviewTab /> : <SuggestionsTab />}
    </div>
  )
}
