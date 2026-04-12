import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, PageHeader } from '@/components/ui'
import { useDataStore } from '@/stores/data'
import { useArcReader } from '@/hooks/useArcReader'
import { useThemeFinder } from '@/hooks/useThemeFinder'
import { aiCompletion } from '@/lib/edgeAi'
import { supabase } from '@/lib/supabase'

export function Story() {
  const { emotionAnalyses, fetchEmotions, loading } = useDataStore()
  const { arc, loading: arcLoading } = useArcReader()
  const { theme, loading: themeLoading, unlocked } = useThemeFinder()

  useEffect(() => {
    fetchEmotions({ days: 90 })
  }, [fetchEmotions])

  // WBI time series for chart
  const wbiTimeline = useMemo(() => {
    if (emotionAnalyses.length === 0) return []
    const sorted = [...emotionAnalyses].sort((a, b) => a.created_at.localeCompare(b.created_at))
    return sorted.map((e) => ({
      date: e.created_at.substring(0, 10),
      wbi: e.wbi_score,
      valence: e.valence,
    }))
  }, [emotionAnalyses])

  const isLoading = loading.emotions || arcLoading || themeLoading

  return (
    <div className="page">
      <PageHeader title="Story" description="日記から見える自分の流れ" />

      {/* Current Arc */}
      {arc && (
        <div className="section">
          <div className="section-title">最近の変化</div>
          <Card>
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.8 }}>
              {arc.narrative}
            </div>
          </Card>
        </div>
      )}

      {/* Theme / Identity */}
      {theme && (
        <div className="section">
          <div className="section-title">あなたのテーマ</div>
          <Card>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8, letterSpacing: '-0.02em' }}>
              {theme.identity}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 16 }}>
              {theme.aspirations}
            </div>

            {/* Emotional DNA */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                  喜びのトリガー
                </div>
                {theme.emotionalDNA.joyTriggers.map((t: string, i: number) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 2 }}>
                    {t}
                  </div>
                ))}
              </div>
              <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                  エネルギー源
                </div>
                {theme.emotionalDNA.energySources.map((s: string, i: number) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 2 }}>
                    {s}
                  </div>
                ))}
              </div>
              <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                  回復スタイル
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                  {theme.emotionalDNA.recoveryStyle}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {!unlocked && !themeLoading && (
        <div className="section">
          <div className="section-title">あなたのテーマ</div>
          <Card style={{ textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>🔒</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>日記を30件以上書くとアンロック</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>あなたの通底テーマとEmotional DNAが見えてきます</div>
          </Card>
        </div>
      )}

      {/* Emotion Insights: 3 cards replacing the old line charts */}
      {emotionAnalyses.length > 2 && (
        <EmotionInsights entries={emotionAnalyses} />
      )}

      {/* Growth Story (#68 + #50) */}
      <GrowthStorySection diaryCount={wbiTimeline.length} />

      {isLoading && wbiTimeline.length === 0 && !arc && (
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ color: 'var(--text3)' }}>Loading...</div>
        </Card>
      )}
    </div>
  )
}

/** Growth Story: generates a narrative covering all available data */
function GrowthStorySection({ diaryCount }: { diaryCount: number }) {
  const [story, setStory] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  // Load cached story
  useEffect(() => {
    supabase
      .from('story_memory')
      .select('narrative_text, updated_at')
      .eq('memory_type', 'chapter')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data?.narrative_text) setStory(data.narrative_text)
      })
  }, [])

  const generate = useCallback(async () => {
    setGenerating(true)
    try {
      // Fetch ALL diary entries (max 100)
      const { data: diaries } = await supabase
        .from('diary_entries')
        .select('body, entry_date, wbi')
        .order('created_at', { ascending: true })
        .limit(100)

      const { data: moments } = await supabase
        .from('story_moments')
        .select('moment_type, title, description, detected_at')
        .order('detected_at', { ascending: true })

      const { data: arc } = await supabase
        .from('story_memory')
        .select('narrative_text')
        .eq('memory_type', 'current_arc')
        .limit(1)
        .single()

      const { data: identity } = await supabase
        .from('story_memory')
        .select('narrative_text')
        .eq('memory_type', 'identity')
        .limit(1)
        .single()

      const diaryText = (diaries || [])
        .map((d) => `[${d.entry_date}] ${d.body.substring(0, 100)}`)
        .join('\n')

      const momentsText = (moments || [])
        .map((m) => `[${m.moment_type}] ${m.title}: ${m.description || ''}`)
        .join('\n')

      const dateRange = diaries && diaries.length > 0
        ? `${diaries[0].entry_date} 〜 ${diaries[diaries.length - 1].entry_date}`
        : '不明'

      const result = await aiCompletion(
        `## 期間: ${dateRange}\n## テーマ: ${identity?.narrative_text || '不明'}\n## 今のフェーズ: ${arc?.narrative_text || '不明'}\n\n## 日記 (${(diaries || []).length}件)\n${diaryText}\n\n## 転機\n${momentsText || 'なし'}`,
        {
          systemPrompt: `あなたはこの人の人生の物語を書く存在。日記・転機・テーマから、この期間の成長物語を書く。

## ルール
- 3人称ではなく2人称（「あなたは〜」）で書く
- 時系列に沿って、感情の流れを追う
- 転機がある場合はそこを物語のターニングポイントにする
- スピリチュアルにならない。友達が語りかける温度感
- 400-600字で
- 最後に「今、あなたは〜」で現在地を締める`,
          temperature: 0.7,
          maxTokens: 800,
          source: 'growth_story',
        },
      )

      const text = result.content.trim()
      setStory(text)

      // Save as chapter
      await supabase.from('story_memory').insert({
        memory_type: 'chapter',
        content: { type: 'growth_story', date_range: dateRange, diary_count: (diaries || []).length },
        narrative_text: text,
      })
    } catch (err) {
      console.error('[Growth Story]', err)
    } finally {
      setGenerating(false)
    }
  }, [])

  return (
    <div className="section">
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>あなたの物語</span>
        <button
          className="btn btn-g btn-sm"
          style={{ fontSize: 10 }}
          onClick={generate}
          disabled={generating || diaryCount < 5}
        >
          {generating ? '生成中...' : story ? '再生成' : '物語を生成'}
        </button>
      </div>
      <Card>
        {story ? (
          <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
            {story}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 8 }}>
              {diaryCount < 5
                ? `日記が${diaryCount}件。あと${5 - diaryCount}件書くと物語が生成できます`
                : '「物語を生成」を押すと、あなたの全期間の成長物語が作られます'}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

// ============================================================
// Emotion Insights — 3 focused cards
// 1. 曜日×時間帯ヒートマップ（個人平均からの偏差）
// 2. 7日移動平均 vs 90日ベースライン
// 3. 今週の最低/最高点 + 当日コンテキスト
// ============================================================

interface EmotionEntry {
  wbi_score: number
  valence: number
  created_at: string
}

function EmotionInsights({ entries }: { entries: EmotionEntry[] }) {
  // Personal baseline (all-period average)
  const baseline = useMemo(() => {
    const valid = entries.filter(e => e.wbi_score > 0)
    if (valid.length === 0) return 5
    return valid.reduce((s, e) => s + e.wbi_score, 0) / valid.length
  }, [entries])

  // ============================================================
  // Card 1: 曜日 × 時間帯 ヒートマップ（偏差）
  // ============================================================
  const heatmap = useMemo(() => {
    // [day-of-week 0=Sun..6=Sat][slot 0=朝/1=昼/2=夕/3=夜]
    const buckets: { sum: number; count: number }[][] = Array.from({ length: 7 }, () =>
      Array.from({ length: 4 }, () => ({ sum: 0, count: 0 }))
    )
    entries.forEach(e => {
      if (e.wbi_score <= 0) return
      const d = new Date(e.created_at)
      const dow = d.getDay()
      const h = d.getHours()
      let slot = 0
      if (h >= 5 && h < 11) slot = 0       // 朝 5-11
      else if (h >= 11 && h < 16) slot = 1 // 昼 11-16
      else if (h >= 16 && h < 20) slot = 2 // 夕 16-20
      else slot = 3                         // 夜 20-5
      buckets[dow][slot].sum += e.wbi_score
      buckets[dow][slot].count += 1
    })
    return buckets.map(row => row.map(b => b.count > 0 ? b.sum / b.count : null))
  }, [entries])

  // Deviation-based color: negative (red) vs positive (green) from baseline
  const colorForDev = (avg: number | null) => {
    if (avg === null) return { bg: 'var(--surface2)', text: 'var(--text3)' }
    const dev = avg - baseline // -5 to +5 typically
    const intensity = Math.min(1, Math.abs(dev) / 1.5) // saturate at ±1.5
    if (dev >= 0) {
      // Green: higher than personal average
      return { bg: `rgba(34, 197, 94, ${0.15 + intensity * 0.45})`, text: '#fff' }
    } else {
      // Red: lower than personal average
      return { bg: `rgba(239, 68, 68, ${0.15 + intensity * 0.45})`, text: '#fff' }
    }
  }

  const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土']
  const SLOT_LABELS = ['朝', '昼', '夕', '夜']

  // ============================================================
  // Card 2: 7日移動平均 vs 90日ベースライン
  // ============================================================
  const trendData = useMemo(() => {
    // Aggregate by day
    const byDay: Record<string, { sum: number; count: number }> = {}
    entries.forEach(e => {
      if (e.wbi_score <= 0) return
      const day = e.created_at.substring(0, 10)
      if (!byDay[day]) byDay[day] = { sum: 0, count: 0 }
      byDay[day].sum += e.wbi_score
      byDay[day].count += 1
    })
    const dayAverages = Object.entries(byDay)
      .map(([day, { sum, count }]) => ({ day, wbi: sum / count }))
      .sort((a, b) => a.day.localeCompare(b.day))

    // 7-day rolling average
    const rolling = dayAverages.map((_, i) => {
      const window = dayAverages.slice(Math.max(0, i - 6), i + 1)
      const avg = window.reduce((s, d) => s + d.wbi, 0) / window.length
      return { day: dayAverages[i].day, wbi: dayAverages[i].wbi, avg7: avg }
    })
    return rolling
  }, [entries])

  // ============================================================
  // Card 3: Recent outliers (lowest + highest of last 14 days)
  // ============================================================
  const outliers = useMemo(() => {
    const recent = entries
      .filter(e => e.wbi_score > 0)
      .filter(e => {
        const d = new Date(e.created_at)
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - 14)
        return d >= cutoff
      })
      .sort((a, b) => a.wbi_score - b.wbi_score)
    return {
      low: recent[0] || null,
      high: recent[recent.length - 1] || null,
    }
  }, [entries])

  const fmtJpDate = (iso: string) => {
    const d = new Date(iso)
    const dow = DOW_LABELS[d.getDay()]
    return `${d.getMonth() + 1}/${d.getDate()}(${dow}) ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  // ============================================================
  // Render
  // ============================================================
  const maxTrend = Math.max(...trendData.map(d => Math.max(d.wbi, d.avg7)), 10)
  const minTrend = Math.min(...trendData.map(d => Math.min(d.wbi, d.avg7)), 0)
  const trendRange = maxTrend - minTrend || 1

  return (
    <div className="section">
      <div className="section-title">感情のパターン</div>

      {/* Card 1: Heatmap */}
      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
          曜日 × 時間帯 — 普段との差
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12 }}>
          <span style={{ color: '#22c55e' }}>緑</span>: 普段より良い　
          <span style={{ color: '#ef4444' }}>赤</span>: 普段より悪い　
          <span style={{ color: 'var(--text3)' }}>個人平均 {baseline.toFixed(1)} からの偏差</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '32px repeat(4, 1fr)', gap: 4 }}>
          <div />
          {SLOT_LABELS.map(s => (
            <div key={s} style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', paddingBottom: 4 }}>{s}</div>
          ))}
          {heatmap.map((row, di) => (
            <React.Fragment key={di}>
              <div style={{ fontSize: 11, color: di === 0 ? '#ef4444' : di === 6 ? '#3b82f6' : 'var(--text3)', display: 'flex', alignItems: 'center', fontWeight: 500 }}>
                {DOW_LABELS[di]}
              </div>
              {row.map((avg, si) => {
                const c = colorForDev(avg)
                const dev = avg !== null ? avg - baseline : 0
                return (
                  <div key={si}
                    title={avg !== null ? `${DOW_LABELS[di]} ${SLOT_LABELS[si]}: ${avg.toFixed(1)} (${dev >= 0 ? '+' : ''}${dev.toFixed(1)})` : 'データなし'}
                    style={{
                      background: c.bg,
                      borderRadius: 4,
                      height: 36,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 600,
                      color: avg !== null ? c.text : 'var(--text3)',
                      fontFamily: 'var(--mono)',
                    }}>
                    {avg !== null ? (dev >= 0 ? '+' : '') + dev.toFixed(1) : '–'}
                  </div>
                )
              })}
            </React.Fragment>
          ))}
        </div>
      </Card>

      {/* Card 2: Trend vs baseline */}
      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
          最近の流れ — 7日移動平均 vs 個人ベースライン
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12 }}>
          点線下 = 普段より落ち込んでる期間。青線 = 7日平均、点線 = 個人平均 ({baseline.toFixed(1)})
        </div>

        <svg viewBox="0 0 400 120" style={{ width: '100%', height: 120 }} preserveAspectRatio="none">
          {/* Baseline horizontal line */}
          <line
            x1={0} x2={400}
            y1={120 - ((baseline - minTrend) / trendRange) * 110 - 5}
            y2={120 - ((baseline - minTrend) / trendRange) * 110 - 5}
            stroke="var(--text3)" strokeWidth="1" strokeDasharray="4 3" opacity="0.5"
          />

          {/* 7-day rolling average line */}
          {trendData.length > 1 && (
            <polyline
              points={trendData.map((d, i) => {
                const x = (i / (trendData.length - 1)) * 400
                const y = 120 - ((d.avg7 - minTrend) / trendRange) * 110 - 5
                return `${x},${y}`
              }).join(' ')}
              fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            />
          )}

          {/* Fill for "below baseline" regions */}
          {trendData.length > 1 && trendData.map((d, i) => {
            if (d.avg7 >= baseline) return null
            const x = (i / (trendData.length - 1)) * 400
            return (
              <circle key={i} cx={x}
                cy={120 - ((d.avg7 - minTrend) / trendRange) * 110 - 5}
                r="3" fill="#ef4444" opacity="0.8" />
            )
          })}
        </svg>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)', marginTop: 4, fontFamily: 'var(--mono)' }}>
          <span>{trendData[0]?.day}</span>
          <span>{trendData[trendData.length - 1]?.day}</span>
        </div>
      </Card>

      {/* Card 3: Outliers */}
      <Card>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
          直近2週間の最低 / 最高
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12 }}>
          平均じゃなく外れ値を見る。その日に何があったかが手がかり
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {outliers.low && (
            <div style={{ background: 'rgba(239, 68, 68, 0.08)', borderLeft: '3px solid #ef4444', padding: '12px 14px', borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 600, letterSpacing: '.5px', marginBottom: 4 }}>🔻 最低</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#ef4444', fontFamily: 'var(--mono)' }}>{outliers.low.wbi_score.toFixed(1)}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{fmtJpDate(outliers.low.created_at)}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
                個人平均より <span style={{ color: '#ef4444', fontWeight: 600 }}>{(outliers.low.wbi_score - baseline).toFixed(1)}</span>
              </div>
            </div>
          )}
          {outliers.high && (
            <div style={{ background: 'rgba(34, 197, 94, 0.08)', borderLeft: '3px solid #22c55e', padding: '12px 14px', borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: '#22c55e', fontWeight: 600, letterSpacing: '.5px', marginBottom: 4 }}>🔺 最高</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#22c55e', fontFamily: 'var(--mono)' }}>{outliers.high.wbi_score.toFixed(1)}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{fmtJpDate(outliers.high.created_at)}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
                個人平均より <span style={{ color: '#22c55e', fontWeight: 600 }}>+{(outliers.high.wbi_score - baseline).toFixed(1)}</span>
              </div>
            </div>
          )}
        </div>
        {(!outliers.low || !outliers.high) && (
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8, textAlign: 'center' }}>
            直近2週間のデータが不足しています
          </div>
        )}
      </Card>
    </div>
  )
}

// React.Fragment import
import React from 'react'
