import { useEffect, useState } from 'react'
import { Card, PageHeader, EmptyState } from '@/components/ui'
import { supabase } from '@/lib/supabase'

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
// Main Page
// ============================================================

export function Insights() {
  return (
    <div className="page">
      <PageHeader title={<>パターンを<strong>知る</strong></>} description="日記から見えてくる、あなたの行動と感情のリズム。" />
      <OverviewTab />
    </div>
  )
}
