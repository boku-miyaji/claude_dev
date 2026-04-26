import { useEffect, useMemo, useState, useCallback } from 'react'
import { Card } from '@/components/ui'
import { useDataStore } from '@/stores/data'
import { aiCompletion } from '@/lib/edgeAi'
import type { EmotionAnalysis } from '@/types/diary'
import { FavoriteQuoteList } from '@/components/FavoriteQuoteList'

type JournalTab = 'diary' | 'favorites'

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

  const [activeTab, setActiveTab] = useState<JournalTab>('diary')

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
          systemPrompt: `感情データから、本人の気づきを呼び起こす「事実 + 問い」を返す。

## 受動生成の制約（design-philosophy ⑪ Active vs Passive Response Boundary）
これはユーザーからの質問・相談への回答ではなく、Journal 画面を開いたら自動で表示されます。
focus-you のターゲットは「行動はわかっているが、一歩が出ない層」。答えは本人の記録の中に既にあります。
**AI が一般化した "示唆" や "解釈" の押し付けは禁止。** 本人の過去の記述と問いで、本人自身に想起させてください。

許される形式は次のいずれか:
1. **事実（データの傾向）+ 問い（本人に想起させる）** のセット
2. **本人の過去の記述・行動への接続** で想起を誘う
3. **SILENT** （問いも引用も思いつかない時は空配列を返す）

## 原則
- 「〜のパターンです」「〜している時期です」等の**AIからの一般化・示唆は禁止**
- 数字をそのまま見せない。「期待が51」ではなく「何かを楽しみにしている気持ちが今週一番強い」
- 抽象ラベル禁止。「飛躍のフェーズ」「探索期」「〜の時期」のような空虚な言葉は使わない
- 各示唆は1〜2文、**必ず問いで閉じる**（問いは疑問形で終わる）。です・ます調

## 沈黙の選択（design-philosophy ⑩）
本人に想起させる問いも、具体的な引用も思いつかない時は **空配列 [] を返してください**。
無難な一般化を絞り出すくらいなら、何も表示しないほうが誠実です。

## 良い例（事実 + 問いで閉じる）
["今週は期待と喜びが強めで、不安も残っています。何か新しいことに向かおうとしていますか？", "人間関係のスコアが他より低めです。誰かとじっくり話した最後の日はいつでしたか？"]

## 悪い例（全部NG）
× "今週は期待と喜びが強い一方で、不安も残ってます。新しいことに踏み出そうとしてる時によくあるパターンです。"（AIが一般化して示唆）
× "Anticipationが51で突出しています"（数字を見せてるだけ）
× "飛躍のフェーズに入っています"（抽象ラベル）
× "素敵な一週間でしたね"（中身がない）
× "〜について考えてみてはどうでしょう"（アドバイス）

問いで閉じる insight を 2〜3個、または沈黙の場合は空配列 [] を JSON で返してください。`,
          jsonMode: true,
          temperature: 0.7,
          maxTokens: 300,
          source: 'emotion_insights',
        },
      )
      const parsed = JSON.parse(result.content)
      const items = Array.isArray(parsed) ? parsed : parsed.insights || parsed.items || []
      // design-philosophy ⑩ Silence over Noise: empty array = model chose silence.
      // Existing UI at line 293 (`insights.length > 0`) already hides the section for empty arrays.
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

  // spec: .journal-tabs + .jtab — 「📔 日記 / ♡ お気に入り名言」のタブ
  const tabBar = (
    <div className="journal-tabs">
      <button
        className={`jtab${activeTab === 'diary' ? ' active' : ''}`}
        onClick={() => setActiveTab('diary')}
      >
        📔 日記
        <span className="sub">{diaryEntries.length}件</span>
      </button>
      <button
        className={`jtab${activeTab === 'favorites' ? ' active' : ''}`}
        onClick={() => setActiveTab('favorites')}
      >
        ♡ お気に入り名言
      </button>
    </div>
  )

  // spec: .page-heading + .page-sub
  const header = (
    <>
      <h1 className="page-heading">日記を<strong>振り返る</strong></h1>
      <p className="page-sub">これまで書いた記録と、感情の流れ。</p>
    </>
  )

  // お気に入りタブは日記データと独立。早期リターンに巻き込まない
  if (activeTab === 'favorites') {
    return (
      <div className="page">
        {header}
        {tabBar}
        <FavoriteQuoteList />
      </div>
    )
  }

  if (isLoading && diaryEntries.length === 0) {
    return (
      <div className="page">
        {header}
        {tabBar}
        <div style={{ color: 'var(--text3)' }}>Loading...</div>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="page">
        {header}
        {tabBar}
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
      {header}
      {tabBar}

      {/* 感情カレンダーは Calendar タブ（気分レイヤー）に統合されました */}

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

      {/* spec: .timeline + .tl-entry — 縦線 + ドット + 日付 + body の構造 */}
      <div className="section">
        <div className="section-title">最近のエントリー</div>
        <div className="timeline">
          {entries.slice(0, 20).map((e) => {
            const badges = getEmotionBadges(e.emotion)
            const date = new Date(e.created_at)
            const dow = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()]
            const dateStr = `${date.getMonth() + 1}/${date.getDate()}`
            const isLong = e.body.length > 200
            return (
              <div key={e.id} className="tl-entry">
                <div className="tl-date">
                  {dateStr}
                  <span className="dow">{dow}</span>
                </div>
                <div className="tl-body">
                  <div className="tl-head">
                    <span className="tl-time">
                      {date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {badges.map((b) => (
                      <span key={b.key} className="emotion-badge" style={{ background: b.color, color: '#fff' }}>
                        {b.label} {b.value}
                      </span>
                    ))}
                    {e.emotion && (
                      <span className="tl-time">WBI {e.emotion.wbi_score.toFixed(1)}</span>
                    )}
                    {e.entry_type && (
                      <span style={{ fontSize: 10, color: 'var(--accent2)' }}>{e.entry_type}</span>
                    )}
                  </div>
                  <div className="tl-text">
                    {isLong ? `${e.body.substring(0, 200)}…` : e.body}
                  </div>
                  {isLong && <span className="tl-expand">続きを読む ↓</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

