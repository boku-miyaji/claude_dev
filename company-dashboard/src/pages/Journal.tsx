import { useEffect, useMemo } from 'react'
import { Card, PageHeader } from '@/components/ui'
import { useDataStore } from '@/stores/data'
import type { EmotionAnalysis } from '@/types/diary'

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

/** Generate casual insights from emotion + PERMA data */
function generateInsights(
  plutchik: Record<string, number>,
  perma: Record<string, number>,
): string[] {
  const insights: string[] = []
  if (Object.keys(plutchik).length === 0) return insights

  // Sort emotions by value
  const sorted = PLUTCHIK.map((p) => ({ key: p.key, label: p.label, val: plutchik[p.key] ?? 0 }))
    .sort((a, b) => b.val - a.val)
  const top1 = sorted[0]
  const top2 = sorted[1]
  const bottom = sorted[sorted.length - 1]

  // --- Emotion pattern insights ---

  // Dominant emotion read
  if (top1 && top1.val > 30) {
    const reads: Record<string, string> = {
      anticipation: `Anticipation が ${Math.round(top1.val)} で突出。何か待ってるもの、もしくは先のことばかり考えてる週。`,
      joy: `Joy が ${Math.round(top1.val)} で一番高い。素直にいい週だったんじゃない？`,
      trust: `Trust が高め。人を信じてる、もしくは安心できる環境にいた週。`,
      fear: `Fear が ${Math.round(top1.val)} でトップ。何かに怯えてる、というより漠然とした不安が多い週。`,
      sadness: `Sadness が支配的。無理に元気出す必要はないけど、何が引きずってるか言語化してみるといいかも。`,
      anger: `Anger がトップ。怒りの裏には「こうあるべき」っていう期待がある。何に期待してた？`,
      surprise: `Surprise が高い週。想定外のことが多かった？良い驚きか悪い驚きかで意味が変わる。`,
      disgust: `Disgust が高いのは珍しい。何か根本的に合わないものに触れてた可能性。`,
    }
    insights.push(reads[top1.key] || `${top1.label} が今週一番強い感情。`)
  }

  // Interesting combo
  if (top1 && top2 && top2.val > 20) {
    if (top1.key === 'anticipation' && top2.key === 'joy') {
      insights.push('期待と喜びのセット。前向きなエネルギーはあるけど、地に足ついてる？')
    } else if (top1.key === 'joy' && (sorted.find((s) => s.key === 'sadness')?.val ?? 0) > 15) {
      insights.push('喜びと悲しみが同居してる。嬉しいことがあった分、失うことへの恐れもあるのかも。')
    } else if (['fear', 'sadness'].includes(top1.key) && ['fear', 'sadness'].includes(top2.key)) {
      insights.push('不安と悲しみが両方高い。ちょっと立ち止まって、何が一番引っかかってるか整理する時間を取ってもいいかも。')
    } else if (top1.key === 'anticipation' && (sorted.find((s) => s.key === 'fear')?.val ?? 0) > 15) {
      insights.push('期待してるけど怖い、っていう状態。新しいことに踏み出そうとしてる時によくあるパターン。')
    }
  }

  // Low bottom
  if (bottom && bottom.val < 3 && top1 && top1.val > 30) {
    insights.push(`${bottom.label} がほぼゼロ。感情の振れ幅が偏ってる週。`)
  }

  // --- PERMA+V insights ---
  if (Object.keys(perma).length > 0) {
    const permaSorted = PERMA_V.map((p) => ({ key: p.key, label: p.label, short: p.short, val: perma[p.key] ?? 0 }))
      .sort((a, b) => a.val - b.val)
    const lowest = permaSorted[0]
    const highest = permaSorted[permaSorted.length - 1]
    const avg = permaSorted.reduce((s, p) => s + p.val, 0) / permaSorted.length

    // Lowest PERMA dimension
    if (lowest && lowest.val < 4) {
      const permaReads: Record<string, string> = {
        perma_r: `Relationships が ${lowest.val.toFixed(1)} で一番低い。人と会ってない、もしくは表面的な関わりだけだった？意識的に誰かと深い話をする時間を作ると変わる。`,
        perma_e: `Engagement が ${lowest.val.toFixed(1)}。没頭できてない。作業はしてるけど「ゾーン」には入れてない週。`,
        perma_a: `Accomplishment が ${lowest.val.toFixed(1)}。やったことに対して「できた」感が薄い。小さくてもいいから完了させる体験を意識的に。`,
        perma_p: `Positive Emotion が ${lowest.val.toFixed(1)}。楽しいと感じる瞬間が少なかった。義務感で動いてない？`,
        perma_m: `Meaning が ${lowest.val.toFixed(1)}。「何のためにやってるんだっけ」状態。大きな目的と今の作業がつながってない感覚。`,
        perma_v: `Vitality が ${lowest.val.toFixed(1)}。体力・気力が落ちてる。睡眠、運動、食事のどれかが崩れてない？`,
      }
      insights.push(permaReads[lowest.key] || `${lowest.label} が今週のボトルネック。`)
    }

    // All middling
    if (avg >= 3.5 && avg <= 5.5 && highest && lowest && (highest.val - lowest.val) < 2.5) {
      insights.push('PERMA+V が全体的に真ん中あたりで横並び。悪くはないけど、突き抜けてるものがない。何か一つに集中してみると全体が引き上がることがある。')
    }

    // High achiever but low vitality
    if ((perma['perma_a'] ?? 0) > 6 && (perma['perma_v'] ?? 0) < 4) {
      insights.push('成果は出てるけど体力が追いついてない。燃え尽きる前兆かも。')
    }

    // High meaning but low positive emotion
    if ((perma['perma_m'] ?? 0) > 6 && (perma['perma_p'] ?? 0) < 4) {
      insights.push('意義は感じてるけど楽しくはない。使命感だけで走ってる状態。どこかで「楽しい」を挟まないと続かない。')
    }
  }

  return insights.slice(0, 3) // Max 3 insights
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
  const insights = useMemo(() => generateInsights(weekPlutchik, weekPerma), [weekPlutchik, weekPerma])

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
      {insights.length > 0 && (
        <div className="section">
          <div className="section-title">読み解き</div>
          <Card>
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
