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

  // Simple sparkline renderer
  const renderSparkline = (data: number[], color: string, height = 48) => {
    if (data.length < 2) return null
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    const w = 100
    const points = data.map((v, i) => {
      const x = (i / (data.length - 1)) * w
      const y = height - ((v - min) / range) * (height - 4) - 2
      return `${x},${y}`
    }).join(' ')
    return (
      <svg viewBox={`0 0 ${w} ${height}`} style={{ width: '100%', height }} preserveAspectRatio="none">
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

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

      {/* Emotion Arc (WBI Timeline) */}
      {wbiTimeline.length > 2 && (
        <div className="section">
          <div className="section-title">感情の軌跡（WBI）</div>
          <Card>
            <div style={{ marginBottom: 8 }}>
              {renderSparkline(wbiTimeline.map((d) => d.wbi), 'var(--accent)', 64)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
              <span>{wbiTimeline[0].date}</span>
              <span>{wbiTimeline[wbiTimeline.length - 1].date}</span>
            </div>
          </Card>
        </div>
      )}

      {/* Valence Timeline */}
      {wbiTimeline.length > 2 && (
        <div className="section">
          <div className="section-title">感情価の推移</div>
          <Card>
            <div style={{ marginBottom: 8 }}>
              {renderSparkline(wbiTimeline.map((d) => d.valence), 'var(--green)', 48)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)' }}>
              <span>ネガティブ ←</span>
              <span>→ ポジティブ</span>
            </div>
          </Card>
        </div>
      )}

      {/* Long-term Trend (#49) */}
      {wbiTimeline.length > 10 && (
        <div className="section">
          <div className="section-title">長期トレンド</div>
          <Card>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, textAlign: 'center', marginBottom: 12 }}>
              {(() => {
                const wbis = wbiTimeline.map((d) => d.wbi).filter((w) => w > 0)
                const avg = wbis.length > 0 ? wbis.reduce((a, b) => a + b, 0) / wbis.length : 0
                const recent = wbis.slice(-7)
                const recentAvg = recent.length > 0 ? recent.reduce((a, b) => a + b, 0) / recent.length : 0
                const trend = recentAvg - avg
                return (
                  <>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{avg.toFixed(1)}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)' }}>全期間 WBI</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: recentAvg > avg ? 'var(--green)' : 'var(--red)' }}>{recentAvg.toFixed(1)}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)' }}>直近7日</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: trend > 0 ? 'var(--green)' : trend < -0.5 ? 'var(--red)' : 'var(--text3)' }}>
                        {trend > 0 ? '+' : ''}{trend.toFixed(1)}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text3)' }}>変化</div>
                    </div>
                  </>
                )
              })()}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>
              {wbiTimeline.length}件のデータ（{wbiTimeline[0]?.date} 〜 {wbiTimeline[wbiTimeline.length - 1]?.date}）
            </div>
          </Card>
        </div>
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
