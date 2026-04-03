import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, PageHeader } from '@/components/ui'

interface DiaryEntry {
  id: string
  content: string
  type: string
  emotion_scores: Record<string, number> | null
  perma_scores: Record<string, number> | null
  created_at: string
}

/** Plutchik 8 emotions with standard colors */
const PLUTCHIK = [
  { key: 'joy', label: 'Joy', color: '#FFD700' },
  { key: 'trust', label: 'Trust', color: '#98FB98' },
  { key: 'fear', label: 'Fear', color: '#228B22' },
  { key: 'surprise', label: 'Surprise', color: '#00CED1' },
  { key: 'sadness', label: 'Sadness', color: '#4169E1' },
  { key: 'disgust', label: 'Disgust', color: '#9370DB' },
  { key: 'anger', label: 'Anger', color: '#FF4500' },
  { key: 'anticipation', label: 'Anticipation', color: '#FFA500' },
]

const PERMA_V = [
  { key: 'P', label: 'Positive Emotion', color: 'var(--accent)' },
  { key: 'E', label: 'Engagement', color: 'var(--blue)' },
  { key: 'R', label: 'Relationships', color: 'var(--green)' },
  { key: 'M', label: 'Meaning', color: 'var(--amber)' },
  { key: 'A', label: 'Accomplishment', color: 'var(--red)' },
  { key: 'V', label: 'Vitality', color: '#00CED1' },
]

/** Generate calendar grid for last 30 days */
function buildCalendarDays(entries: DiaryEntry[]): { date: string; hasEntry: boolean; emotionColor: string | null }[] {
  const dateMap = new Map<string, DiaryEntry[]>()
  for (const e of entries) {
    const d = e.created_at.substring(0, 10)
    if (!dateMap.has(d)) dateMap.set(d, [])
    dateMap.get(d)!.push(e)
  }

  const days: { date: string; hasEntry: boolean; emotionColor: string | null }[] = []
  const today = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const dayEntries = dateMap.get(key) || []
    let emotionColor: string | null = null
    if (dayEntries.length > 0) {
      // Find dominant emotion from emotion_scores
      for (const entry of dayEntries) {
        if (entry.emotion_scores) {
          let maxKey = ''
          let maxVal = 0
          for (const [k, v] of Object.entries(entry.emotion_scores)) {
            if (typeof v === 'number' && v > maxVal) { maxVal = v; maxKey = k }
          }
          const match = PLUTCHIK.find((p) => p.key === maxKey)
          if (match) emotionColor = match.color
        }
      }
      if (!emotionColor) emotionColor = 'var(--accent2)' // has entry but no emotion data
    }
    days.push({ date: key, hasEntry: dayEntries.length > 0, emotionColor })
  }
  return days
}

/** Aggregate Plutchik scores from entries */
function aggregatePlutchik(entries: DiaryEntry[]): Record<string, number> {
  const totals: Record<string, number> = {}
  let count = 0
  for (const e of entries) {
    if (e.emotion_scores) {
      count++
      for (const [k, v] of Object.entries(e.emotion_scores)) {
        if (typeof v === 'number') {
          totals[k] = (totals[k] || 0) + v
        }
      }
    }
  }
  if (count === 0) return {}
  for (const k of Object.keys(totals)) {
    totals[k] = totals[k] / count
  }
  return totals
}

/** Aggregate PERMA+V scores */
function aggregatePerma(entries: DiaryEntry[]): Record<string, number> {
  const totals: Record<string, number> = {}
  let count = 0
  for (const e of entries) {
    if (e.perma_scores) {
      count++
      for (const [k, v] of Object.entries(e.perma_scores)) {
        if (typeof v === 'number') {
          totals[k] = (totals[k] || 0) + v
        }
      }
    }
  }
  if (count === 0) return {}
  for (const k of Object.keys(totals)) {
    totals[k] = totals[k] / count
  }
  return totals
}

export function Journal() {
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const { data } = await supabase
      .from('diary_entries')
      .select('*')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
    setEntries((data as DiaryEntry[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const calendarDays = useMemo(() => buildCalendarDays(entries), [entries])
  const plutchikScores = useMemo(() => aggregatePlutchik(entries), [entries])
  const permaScores = useMemo(() => aggregatePerma(entries), [entries])
  const hasEmotionData = Object.keys(plutchikScores).length > 0
  const hasPermaData = Object.keys(permaScores).length > 0

  // Week entries for Plutchik
  const weekEntries = useMemo(() => {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return entries.filter((e) => new Date(e.created_at) >= weekAgo)
  }, [entries])
  const weekPlutchik = useMemo(() => aggregatePlutchik(weekEntries), [weekEntries])

  if (loading) {
    return (
      <div className="page">
        <PageHeader title="Journal" />
        <div style={{ color: 'var(--text3)' }}>Loading...</div>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="page">
        <PageHeader title="Journal" description="感情の可視化と振り返り" />
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📔</div>
          <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 8 }}>
            まだデータがありません
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            Today ページで日記を書くと分析が始まります
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader title="Journal" description="感情の可視化と振り返り" />

      {/* Emotion Calendar Heatmap */}
      <div className="section">
        <div className="section-title">感情カレンダー (過去30日)</div>
        <Card>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 6,
            maxWidth: 280,
          }}>
            {['月', '火', '水', '木', '金', '土', '日'].map((d) => (
              <div key={d} style={{ fontSize: 9, color: 'var(--text3)', textAlign: 'center', fontWeight: 600 }}>{d}</div>
            ))}
            {/* Offset for alignment: first day of the 30-day range */}
            {calendarDays.map((day) => (
              <div
                key={day.date}
                title={day.date}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: day.emotionColor || (day.hasEntry ? 'var(--accent-bg)' : 'var(--surface2)'),
                  opacity: day.hasEntry ? 1 : 0.4,
                  margin: '0 auto',
                  transition: 'all .2s',
                }}
              />
            ))}
          </div>
        </Card>
      </div>

      {/* Plutchik 8 emotions (this week) */}
      <div className="section">
        <div className="section-title">今週の感情</div>
        <Card>
          {!hasEmotionData && Object.keys(weekPlutchik).length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text3)', padding: 16, textAlign: 'center' }}>
              感情分析データがまだありません。日記を書き続けると分析が始まります。
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {PLUTCHIK.map((p) => {
                const val = weekPlutchik[p.key] ?? plutchikScores[p.key] ?? 0
                const maxVal = 10
                const pct = Math.min((val / maxVal) * 100, 100)
                return (
                  <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, width: 80, color: 'var(--text2)', fontWeight: 500 }}>{p.label}</span>
                    <div style={{ flex: 1, height: 8, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: p.color, borderRadius: 4, transition: 'width .4s ease' }} />
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', width: 30, textAlign: 'right' }}>
                      {val > 0 ? val.toFixed(1) : '-'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* PERMA+V */}
      <div className="section">
        <div className="section-title">PERMA+V</div>
        <Card>
          {!hasPermaData ? (
            <div style={{ fontSize: 12, color: 'var(--text3)', padding: 16, textAlign: 'center' }}>
              PERMA+V データがまだありません。
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {PERMA_V.map((p) => {
                const val = permaScores[p.key] ?? 0
                const pct = Math.min((val / 10) * 100, 100)
                return (
                  <div key={p.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 500 }}>
                        <strong style={{ color: p.color }}>{p.key}</strong> {p.label}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                        {val > 0 ? val.toFixed(1) : '-'}/10
                      </span>
                    </div>
                    <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: p.color, borderRadius: 3, transition: 'width .4s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Recent entries */}
      <div className="section">
        <div className="section-title">最近のエントリー</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.slice(0, 20).map((e) => (
            <Card key={e.id} style={{ padding: 14 }}>
              <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, marginBottom: 6 }}>
                {e.content.length > 200 ? `${e.content.substring(0, 200)}...` : e.content}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', display: 'flex', gap: 8 }}>
                <span>{new Date(e.created_at).toLocaleDateString('ja-JP')}</span>
                <span>{new Date(e.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</span>
                {e.type && <span style={{ color: 'var(--accent2)' }}>{e.type}</span>}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
