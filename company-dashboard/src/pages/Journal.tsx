import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, PageHeader } from '@/components/ui'

interface DiaryEntry {
  id: string
  body: string
  entry_type: string | null
  mood_score: number | null
  wbi: number | null
  entry_date: string | null
  created_at: string
}

interface EmotionAnalysis {
  id: string
  diary_entry_id: string
  joy: number
  trust: number
  fear: number
  surprise: number
  sadness: number
  disgust: number
  anger: number
  anticipation: number
  valence: number
  arousal: number
  perma_p: number
  perma_e: number
  perma_r: number
  perma_m: number
  perma_a: number
  perma_v: number
  wbi_score: number
  created_at: string
}

interface EntryWithEmotion extends DiaryEntry {
  emotion?: EmotionAnalysis
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
] as const

const PERMA_V = [
  { key: 'perma_p', label: 'Positive Emotion', short: 'P', color: 'var(--accent)' },
  { key: 'perma_e', label: 'Engagement', short: 'E', color: 'var(--blue)' },
  { key: 'perma_r', label: 'Relationships', short: 'R', color: 'var(--green)' },
  { key: 'perma_m', label: 'Meaning', short: 'M', color: 'var(--amber)' },
  { key: 'perma_a', label: 'Accomplishment', short: 'A', color: 'var(--red)' },
  { key: 'perma_v', label: 'Vitality', short: 'V', color: '#00CED1' },
] as const

/** Find dominant emotion from an EmotionAnalysis record */
function getDominantEmotion(e: EmotionAnalysis): { key: string; color: string } | null {
  let maxKey = ''
  let maxVal = 0
  for (const p of PLUTCHIK) {
    const val = e[p.key as keyof EmotionAnalysis] as number
    if (val > maxVal) {
      maxVal = val
      maxKey = p.key
    }
  }
  if (!maxKey) return null
  const match = PLUTCHIK.find((p) => p.key === maxKey)
  return match ? { key: match.key, color: match.color } : null
}

/** Generate calendar grid for last 30 days */
function buildCalendarDays(
  entries: DiaryEntry[],
  emotionMap: Map<string, EmotionAnalysis>,
): { date: string; hasEntry: boolean; emotionColor: string | null }[] {
  // Map entries by date
  const dateEntryMap = new Map<string, string[]>()
  for (const e of entries) {
    const d = e.created_at.substring(0, 10)
    if (!dateEntryMap.has(d)) dateEntryMap.set(d, [])
    dateEntryMap.get(d)!.push(e.id)
  }

  const days: { date: string; hasEntry: boolean; emotionColor: string | null }[] = []
  const today = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const entryIds = dateEntryMap.get(key) || []
    let emotionColor: string | null = null

    if (entryIds.length > 0) {
      // Find emotion from any entry that day
      for (const eid of entryIds) {
        const ea = emotionMap.get(eid)
        if (ea) {
          const dominant = getDominantEmotion(ea)
          if (dominant) {
            emotionColor = dominant.color
            break
          }
        }
      }
      if (!emotionColor) emotionColor = 'var(--accent2)'
    }
    days.push({ date: key, hasEntry: entryIds.length > 0, emotionColor })
  }
  return days
}

/** Aggregate Plutchik from emotion_analysis records */
function aggregatePlutchik(analyses: EmotionAnalysis[]): Record<string, number> {
  if (analyses.length === 0) return {}
  const totals: Record<string, number> = {}
  for (const e of analyses) {
    for (const p of PLUTCHIK) {
      const val = e[p.key as keyof EmotionAnalysis] as number
      totals[p.key] = (totals[p.key] ?? 0) + val
    }
  }
  for (const k of Object.keys(totals)) {
    totals[k] = totals[k] / analyses.length
  }
  return totals
}

/** Aggregate PERMA+V from emotion_analysis records */
function aggregatePerma(analyses: EmotionAnalysis[]): Record<string, number> {
  if (analyses.length === 0) return {}
  const totals: Record<string, number> = {}
  for (const e of analyses) {
    for (const p of PERMA_V) {
      const val = e[p.key as keyof EmotionAnalysis] as number
      totals[p.key] = (totals[p.key] ?? 0) + val
    }
  }
  for (const k of Object.keys(totals)) {
    totals[k] = totals[k] / analyses.length
  }
  return totals
}

/** Get top 2 emotion badges for an entry */
function getEmotionBadges(ea: EmotionAnalysis | undefined): { key: string; label: string; color: string; value: number }[] {
  if (!ea) return []
  const scored = PLUTCHIK.map((p) => ({
    key: p.key,
    label: p.label,
    color: p.color,
    value: ea[p.key as keyof EmotionAnalysis] as number,
  }))
  scored.sort((a, b) => b.value - a.value)
  return scored.filter((s) => s.value > 20).slice(0, 2)
}

export function Journal() {
  const [entries, setEntries] = useState<EntryWithEmotion[]>([])
  const [emotions, setEmotions] = useState<EmotionAnalysis[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [diaryRes, emotionRes] = await Promise.all([
      supabase
        .from('diary_entries')
        .select('*')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false }),
      supabase
        .from('emotion_analysis')
        .select('*')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false }),
    ])

    const diaryData = (diaryRes.data as DiaryEntry[]) || []
    const emotionData = (emotionRes.data as EmotionAnalysis[]) || []
    setEmotions(emotionData)

    // Build emotion map by diary_entry_id
    const emotionMap = new Map<string, EmotionAnalysis>()
    for (const ea of emotionData) {
      // Keep the latest emotion analysis per entry
      if (!emotionMap.has(ea.diary_entry_id)) {
        emotionMap.set(ea.diary_entry_id, ea)
      }
    }

    // Attach emotions to entries
    const enriched: EntryWithEmotion[] = diaryData.map((e) => ({
      ...e,
      emotion: emotionMap.get(e.id),
    }))
    setEntries(enriched)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Build emotion map for calendar
  const emotionMap = useMemo(() => {
    const map = new Map<string, EmotionAnalysis>()
    for (const ea of emotions) {
      if (!map.has(ea.diary_entry_id)) {
        map.set(ea.diary_entry_id, ea)
      }
    }
    return map
  }, [emotions])

  const calendarDays = useMemo(
    () => buildCalendarDays(entries, emotionMap),
    [entries, emotionMap],
  )

  // Week entries for Plutchik and PERMA
  const weekAnalyses = useMemo(() => {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return emotions.filter((e) => new Date(e.created_at) >= weekAgo)
  }, [emotions])

  const weekPlutchik = useMemo(() => aggregatePlutchik(weekAnalyses), [weekAnalyses])
  const weekPerma = useMemo(() => aggregatePerma(weekAnalyses), [weekAnalyses])
  const hasWeekPlutchik = Object.keys(weekPlutchik).length > 0
  const hasWeekPerma = Object.keys(weekPerma).length > 0

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
          {!hasWeekPlutchik ? (
            <div style={{ fontSize: 12, color: 'var(--text3)', padding: 16, textAlign: 'center' }}>
              感情分析データがまだありません。日記を書き続けると分析が始まります。
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {PLUTCHIK.map((p) => {
                const val = weekPlutchik[p.key] ?? 0
                const pct = Math.min((val / 100) * 100, 100)
                return (
                  <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, width: 80, color: 'var(--text2)', fontWeight: 500 }}>{p.label}</span>
                    <div style={{ flex: 1, height: 8, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: p.color, borderRadius: 4, transition: 'width .4s ease' }} />
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', width: 30, textAlign: 'right' }}>
                      {val > 0 ? Math.round(val).toString() : '-'}
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
        <div className="section-title">PERMA+V (今週)</div>
        <Card>
          {!hasWeekPerma ? (
            <div style={{ fontSize: 12, color: 'var(--text3)', padding: 16, textAlign: 'center' }}>
              PERMA+V データがまだありません。
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {PERMA_V.map((p) => {
                const val = weekPerma[p.key] ?? 0
                const pct = Math.min((val / 10) * 100, 100)
                return (
                  <div key={p.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 500 }}>
                        <strong style={{ color: p.color }}>{p.short}</strong> {p.label}
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
          {entries.slice(0, 20).map((e) => {
            const badges = getEmotionBadges(e.emotion)
            return (
              <Card key={e.id} style={{ padding: 14 }}>
                <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, marginBottom: 6 }}>
                  {e.body.length > 200 ? `${e.body.substring(0, 200)}...` : e.body}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                    {new Date(e.created_at).toLocaleDateString('ja-JP')}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                    {new Date(e.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {e.entry_type && (
                    <span style={{ fontSize: 10, color: 'var(--accent2)' }}>{e.entry_type}</span>
                  )}
                  {badges.map((b) => (
                    <span
                      key={b.key}
                      style={{
                        fontSize: 9,
                        padding: '2px 6px',
                        borderRadius: 10,
                        background: b.color,
                        color: '#fff',
                        fontWeight: 600,
                        opacity: 0.85,
                      }}
                    >
                      {b.label} {b.value}
                    </span>
                  ))}
                  {e.emotion && (
                    <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                      WBI {e.emotion.wbi_score.toFixed(1)}
                    </span>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
