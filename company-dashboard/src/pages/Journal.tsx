import { useEffect, useMemo, useState, useCallback } from 'react'
import { Card, PageHeader } from '@/components/ui'
import { useDataStore } from '@/stores/data'
import { aiCompletion } from '@/lib/edgeAi'
import type { EmotionAnalysis } from '@/types/diary'

/** Plutchik 8 emotions with standard colors */
const PLUTCHIK = [
  { key: 'joy', label: '喜び', color: '#FFD700' },
  { key: 'trust', label: '信頼', color: '#98FB98' },
  { key: 'fear', label: '不安', color: '#228B22' },
  { key: 'surprise', label: '驚き', color: '#00CED1' },
  { key: 'sadness', label: '悲しみ', color: '#4169E1' },
  { key: 'disgust', label: '嫌悪', color: '#9370DB' },
  { key: 'anger', label: '怒り', color: '#FF4500' },
  { key: 'anticipation', label: '期待', color: '#FFA500' },
] as const

const PERMA_V = [
  { key: 'perma_p', label: 'ポジティブ感情', short: 'P', color: 'var(--accent)' },
  { key: 'perma_e', label: '没頭', short: 'E', color: 'var(--blue)' },
  { key: 'perma_r', label: '人間関係', short: 'R', color: 'var(--green)' },
  { key: 'perma_m', label: '意味', short: 'M', color: 'var(--amber)' },
  { key: 'perma_a', label: '達成', short: 'A', color: 'var(--red)' },
  { key: 'perma_v', label: '活力', short: 'V', color: '#00CED1' },
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
  entries: { id: string; created_at: string }[],
  emotionMap: Map<string, EmotionAnalysis>,
): { date: string; hasEntry: boolean; emotionColor: string | null }[] {
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
  const {
    diaryEntries, emotionAnalyses,
    fetchDiary, fetchEmotions,
    loading,
  } = useDataStore()

  useEffect(() => {
    fetchDiary({ days: 30 })
    fetchEmotions({ days: 30 })
  }, [fetchDiary, fetchEmotions])

  // Build emotion map by diary_entry_id
  const emotionMap = useMemo(() => {
    const map = new Map<string, EmotionAnalysis>()
    for (const ea of emotionAnalyses) {
      if (!map.has(ea.diary_entry_id)) {
        map.set(ea.diary_entry_id, ea)
      }
    }
    return map
  }, [emotionAnalyses])

  // Attach emotions to entries
  const entries = useMemo(() => {
    return diaryEntries.map((e) => ({
      ...e,
      emotion: emotionMap.get(e.id),
    }))
  }, [diaryEntries, emotionMap])

  const calendarDays = useMemo(
    () => buildCalendarDays(diaryEntries, emotionMap),
    [diaryEntries, emotionMap],
  )

  // Week entries for Plutchik and PERMA
  const weekAnalyses = useMemo(() => {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return emotionAnalyses.filter((e) => new Date(e.created_at) >= weekAgo)
  }, [emotionAnalyses])

  const weekPlutchik = useMemo(() => aggregatePlutchik(weekAnalyses), [weekAnalyses])
  const weekPerma = useMemo(() => aggregatePerma(weekAnalyses), [weekAnalyses])
  const hasWeekPlutchik = Object.keys(weekPlutchik).length > 0
  const hasWeekPerma = Object.keys(weekPerma).length > 0

  // AI-generated insights
  const [insights, setInsights] = useState<string[]>([])
  const [insightsLoading, setInsightsLoading] = useState(false)

  // Build a stable cache key from the data
  const insightsCacheKey = useMemo(() => {
    if (!hasWeekPlutchik && !hasWeekPerma) return ''
    const vals = PLUTCHIK.map((p) => Math.round(weekPlutchik[p.key] ?? 0))
      .concat(PERMA_V.map((p) => Math.round((weekPerma[p.key] ?? 0) * 10)))
    return vals.join(',')
  }, [weekPlutchik, weekPerma, hasWeekPlutchik, hasWeekPerma])

  const fetchInsights = useCallback(async () => {
    if (!insightsCacheKey) return

    // Check sessionStorage cache
    const cached = sessionStorage.getItem(`insights:${insightsCacheKey}`)
    if (cached) {
      setInsights(JSON.parse(cached))
      return
    }

    setInsightsLoading(true)
    try {
      const plutchikSummary = PLUTCHIK.map((p) =>
        `${p.label}: ${Math.round(weekPlutchik[p.key] ?? 0)}`
      ).join(', ')
      const permaSummary = PERMA_V.map((p) =>
        `${p.short}(${p.label}): ${(weekPerma[p.key] ?? 0).toFixed(1)}/10`
      ).join(', ')

      const result = await aiCompletion(
        `今週の感情データ:\n${plutchikSummary}\n\nPERMA+V:\n${permaSummary}`,
        {
          systemPrompt: `感情データから、この人が気づいていないパターンや傾向を見つけて示唆として返す。

## 原則
- 事実（データの傾向）→ 示唆（だから何が言えるか）のセットで書く
- 数字をそのまま見せない。「期待が51」ではなく「何かを楽しみにしている気持ちが今週一番強い」
- 抽象ラベル禁止。「飛躍のフェーズ」「探索期」のような空虚な言葉は使わない
- 各示唆は1〜2文。です・ます調

## 良い例
["今週は期待と喜びが強い一方で、不安も残ってます。新しいことに踏み出そうとしてる時によくあるパターンです。", "人間関係のスコアが他より低めです。ここ最近、誰かとじっくり話す時間が減っていませんか。"]

## 悪い例
["Anticipationが51で突出しています"（数字を見せてるだけ）, "飛躍のフェーズに入っています"（抽象ラベル）, "素敵な一週間でしたね"（中身がない）]

2〜3個の示唆をJSON配列で返してください。`,
          jsonMode: true,
          temperature: 0.7,
          maxTokens: 300,
          source: 'emotion_insights',
        },
      )
      const parsed = JSON.parse(result.content)
      const items = Array.isArray(parsed) ? parsed : parsed.insights || parsed.items || []
      setInsights(items)
      sessionStorage.setItem(`insights:${insightsCacheKey}`, JSON.stringify(items))
    } catch {
      setInsights([])
    } finally {
      setInsightsLoading(false)
    }
  }, [insightsCacheKey, weekPlutchik, weekPerma])

  useEffect(() => {
    fetchInsights()
  }, [fetchInsights])

  const isLoading = loading.diary || loading.emotions

  if (isLoading && diaryEntries.length === 0) {
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

      {/* Insights */}
      {(hasWeekPlutchik || hasWeekPerma) && (
        <div className="section">
          <div className="section-title">読み解き</div>
          <Card>
            {insightsLoading ? (
              <div style={{ fontSize: 12, color: 'var(--text3)', padding: 16, textAlign: 'center' }}>
                考え中...
              </div>
            ) : insights.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0' }}>
                {insights.map((text, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 13,
                      lineHeight: 1.7,
                      color: 'var(--text2)',
                      paddingLeft: 12,
                      borderLeft: `2px solid ${i === 0 ? 'var(--accent)' : 'var(--border)'}`,
                    }}
                  >
                    {text}
                  </div>
                ))}
              </div>
            ) : null}
          </Card>
        </div>
      )}

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
