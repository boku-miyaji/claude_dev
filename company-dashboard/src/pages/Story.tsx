import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, PageHeader } from '@/components/ui'
import { useDataStore } from '@/stores/data'
import { useArcReader } from '@/hooks/useArcReader'
import { useThemeFinder } from '@/hooks/useThemeFinder'
import { aiCompletion } from '@/lib/edgeAi'
import { supabase } from '@/lib/supabase'
import { fetchCalendarEvents } from '@/lib/calendarApi'
import type { CalendarEvent } from '@/types/calendar'

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

interface DiaryRow {
  entry_date: string
  body: string | null
  ai_summary: string | null
  calendar_events: Array<{ summary?: string; start?: string }> | null
}

function EmotionInsights({ entries }: { entries: EmotionEntry[] }) {
  const [diaryByDate, setDiaryByDate] = useState<Record<string, DiaryRow>>({})
  const [eventsByDate, setEventsByDate] = useState<Record<string, CalendarEvent[]>>({})
  const [selectedCell, setSelectedCell] = useState<{ dow: number; slot: number } | null>(null)

  // Personal baseline + stddev (for adaptive color scaling)
  const { baseline, stddev } = useMemo(() => {
    const valid = entries.filter(e => e.wbi_score > 0)
    if (valid.length === 0) return { baseline: 5, stddev: 1 }
    const avg = valid.reduce((s, e) => s + e.wbi_score, 0) / valid.length
    const variance = valid.reduce((s, e) => s + (e.wbi_score - avg) ** 2, 0) / valid.length
    const sd = Math.max(0.3, Math.sqrt(variance))
    return { baseline: avg, stddev: sd }
  }, [entries])

  // Fetch diary entries + Google Calendar events for emotion range
  useEffect(() => {
    if (entries.length === 0) return
    const dates = Array.from(new Set(entries.map(e => e.created_at.substring(0, 10)))).sort()
    const earliest = dates[0]
    const latest = dates[dates.length - 1]

    // 1. Diary entries (body / summary for Card 3 snippet)
    supabase
      .from('diary_entries')
      .select('entry_date,body,ai_summary,calendar_events')
      .gte('entry_date', earliest)
      .lte('entry_date', latest)
      .then(({ data }) => {
        const map: Record<string, DiaryRow> = {}
        ;(data || []).forEach((r: DiaryRow) => { map[r.entry_date] = r })
        setDiaryByDate(map)
      })

    // 2. Google Calendar events (for event correlation — Card 4)
    // Gracefully fail if user isn't authed with Google Calendar
    const timeMin = new Date(earliest + 'T00:00:00+09:00').toISOString()
    const timeMax = new Date(latest + 'T23:59:59+09:00').toISOString()
    fetchCalendarEvents({ timeMin, timeMax, maxResults: 500 })
      .then(({ events }) => {
        const map: Record<string, CalendarEvent[]> = {}
        events.forEach(ev => {
          const day = new Date(ev.start_time).toISOString().substring(0, 10)
          if (!map[day]) map[day] = []
          map[day].push(ev)
        })
        setEventsByDate(map)
      })
      .catch(() => {
        // Silent fail — Card 4 will just not show if no events
      })
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

  // Z-score based semantic labels (normalized by personal stddev)
  // More meaningful than raw numbers — answers "普段と比べてどう？"
  const labelFor = (avg: number | null): { label: string; level: number; color: string; bg: string } => {
    if (avg === null) return { label: '記録なし', level: 0, color: 'var(--text3)', bg: 'var(--surface2)' }
    const z = (avg - baseline) / stddev
    const absZ = Math.abs(z)

    // Choose semantic label
    let label: string
    if (absZ < 0.5) label = '普段通り'
    else if (absZ < 1.0) label = z > 0 ? 'やや良い' : 'やや悪い'
    else if (absZ < 1.5) label = z > 0 ? '良い' : '悪い'
    else label = z > 0 ? 'とても良い' : 'とても悪い'

    // Neutral band → subtle gray
    if (absZ < 0.5) {
      return { label, level: 0, color: 'var(--text2)', bg: 'var(--surface2)' }
    }

    // Colored bands
    const intensity = Math.min(1, absZ / 1.8)
    const alpha = 0.35 + intensity * 0.5  // 0.35 → 0.85
    if (z > 0) {
      return { label, level: Math.ceil(absZ), color: '#fff', bg: `rgba(34, 197, 94, ${alpha})` }
    } else {
      return { label, level: -Math.ceil(absZ), color: '#fff', bg: `rgba(239, 68, 68, ${alpha})` }
    }
  }

  // Day-averaged WBI (shared by heatmap and event correlation)
  const dayWbi = useMemo(() => {
    const byDay: Record<string, { sum: number; count: number }> = {}
    entries.forEach(e => {
      if (e.wbi_score <= 0) return
      const day = e.created_at.substring(0, 10)
      if (!byDay[day]) byDay[day] = { sum: 0, count: 0 }
      byDay[day].sum += e.wbi_score
      byDay[day].count += 1
    })
    const result: Record<string, number> = {}
    Object.entries(byDay).forEach(([day, { sum, count }]) => { result[day] = sum / count })
    return result
  }, [entries])

  // Event correlation: tag-based + exact-name matching
  const eventPatterns = useMemo(() => {
    // Extract multiple tags from one event summary.
    // Each tag represents a dimension: category / type / specific.
    // Tags have prefixes for display: category | type | event
    const extractTags = (summary: string): { key: string; display: string; kind: 'category' | 'type' | 'event' }[] => {
      const tags: { key: string; display: string; kind: 'category' | 'type' | 'event' }[] = []
      const s = summary.trim()

      // 1. Bracket prefix: [In], [Ex], [External] etc
      const bracketMatch = s.match(/^\[([^\]]{1,12})\]/)
      if (bracketMatch) {
        const raw = bracketMatch[1].trim()
        // Normalize common aliases
        let norm = raw.toLowerCase()
        if (norm === 'in' || norm === 'internal' || norm === '社内') norm = 'In'
        else if (norm === 'ex' || norm === 'external' || norm === '社外') norm = 'Ex'
        else norm = raw
        tags.push({ key: `cat:${norm.toLowerCase()}`, display: `[${norm}]`, kind: 'category' })
      }

      // 2. Meeting type keywords
      const keywords: { match: RegExp; display: string }[] = [
        { match: /定例/, display: '定例' },
        { match: /レビュー|review/i, display: 'レビュー' },
        { match: /1on1|1:1|1-on-1/i, display: '1on1' },
        { match: /面談|interview/i, display: '面談' },
        { match: /会食|dinner/i, display: '会食' },
        { match: /ランチ|lunch/i, display: 'ランチ' },
        { match: /飲み会/, display: '飲み会' },
        { match: /打ち合わせ|打合せ|打合|mtg|meeting/i, display: 'MTG' },
        { match: /勉強会|study/i, display: '勉強会' },
        { match: /朝会|standup/i, display: '朝会' },
        { match: /夕会/, display: '夕会' },
        { match: /デモ|demo/i, display: 'デモ' },
        { match: /sync/i, display: 'Sync' },
        { match: /振り返り|retro/i, display: '振り返り' },
        { match: /提案|pitch/i, display: '提案' },
        { match: /作業|もくもく/, display: '作業' },
      ]
      keywords.forEach(k => {
        if (k.match.test(s)) {
          tags.push({ key: `type:${k.display}`, display: k.display, kind: 'type' })
        }
      })

      // 3. Exact normalized name (specific recurring event)
      const normalized = s.toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/\s*\(\d+\)\s*$/, '')
        .replace(/^\[.*?\]\s*/, '')
      if (normalized && normalized.length >= 2) {
        // Use cleaned display (keep original case but strip prefix)
        const displayClean = s.replace(/^\[.*?\]\s*/, '').replace(/\s*\(\d+\)\s*$/, '').trim()
        tags.push({ key: `event:${normalized}`, display: displayClean, kind: 'event' })
      }

      return tags
    }

    const evs: Record<string, {
      display: string
      kind: 'category' | 'type' | 'event'
      dayWbis: number[]
      prevWbis: number[]
    }> = {}

    // Iterate days that have both a WBI score AND calendar events
    Object.entries(eventsByDate).forEach(([day, events]) => {
      const wbi = dayWbi[day]
      if (wbi === undefined) return

      // Dedupe tags per day (one event might match multiple keywords, but per day we count once)
      const seenTagsToday = new Set<string>()
      events.forEach(ev => {
        const summary = ev?.summary
        if (!summary || typeof summary !== 'string') return
        extractTags(summary).forEach(tag => {
          if (seenTagsToday.has(tag.key)) return
          seenTagsToday.add(tag.key)
          if (!evs[tag.key]) evs[tag.key] = { display: tag.display, kind: tag.kind, dayWbis: [], prevWbis: [] }
          evs[tag.key].dayWbis.push(wbi)
          // Previous day
          const prev = new Date(day)
          prev.setDate(prev.getDate() - 1)
          const prevKey = prev.toISOString().substring(0, 10)
          if (dayWbi[prevKey] !== undefined) evs[tag.key].prevWbis.push(dayWbi[prevKey])
        })
      })
    })

    // Different minimum thresholds by kind
    // category (In/Ex) → 5回以上, type → 3回以上, event → 3回以上
    const minOccurrences = (kind: string) => kind === 'category' ? 5 : 3
    const SIGNIFICANCE = 0.5

    const results = Object.entries(evs)
      .filter(([, e]) => e.dayWbis.length >= minOccurrences(e.kind))
      .map(([key, e]) => {
        const avgDay = e.dayWbis.reduce((s, w) => s + w, 0) / e.dayWbis.length
        const avgPrev = e.prevWbis.length >= 2
          ? e.prevWbis.reduce((s, w) => s + w, 0) / e.prevWbis.length
          : null
        const dayDev = avgDay - baseline
        const prevDev = avgPrev !== null ? avgPrev - baseline : null
        const maxAbsDev = Math.max(Math.abs(dayDev), prevDev !== null ? Math.abs(prevDev) : 0)
        return { key, display: e.display, kind: e.kind, count: e.dayWbis.length, avgDay, avgPrev, dayDev, prevDev, maxAbsDev }
      })
      .filter(r => r.maxAbsDev >= SIGNIFICANCE * stddev)
      .sort((a, b) => b.maxAbsDev - a.maxAbsDev)

    // Split into negative/positive. Separate by kind so user sees category/type/specific levels
    return {
      negative: results.filter(r => r.dayDev < 0 || (r.prevDev !== null && r.prevDev < -stddev * SIGNIFICANCE)).slice(0, 8),
      positive: results.filter(r => r.dayDev > 0 && !(r.prevDev !== null && r.prevDev < -stddev * SIGNIFICANCE)).slice(0, 8),
    }
  }, [eventsByDate, dayWbi, baseline, stddev])

  // Keep cell count map for displaying sample size
  const cellCounts = useMemo(() => {
    const buckets: number[][] = Array.from({ length: 7 }, () => Array.from({ length: 4 }, () => 0))
    entries.forEach(e => {
      if (e.wbi_score <= 0) return
      const d = new Date(e.created_at)
      const dow = d.getDay()
      const h = d.getHours()
      let slot = 0
      if (h >= 5 && h < 11) slot = 0
      else if (h >= 11 && h < 16) slot = 1
      else if (h >= 16 && h < 20) slot = 2
      else slot = 3
      buckets[dow][slot] += 1
    })
    return buckets
  }, [entries])

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
  // Render — auto-zoom Y axis to actual data range (not 0-10)
  // ============================================================
  const trendValues = trendData.flatMap(d => [d.wbi, d.avg7]).concat([baseline])
  const dataMax = trendValues.length > 0 ? Math.max(...trendValues) : 10
  const dataMin = trendValues.length > 0 ? Math.min(...trendValues) : 0
  const pad = Math.max(0.5, (dataMax - dataMin) * 0.15)
  const maxTrend = Math.min(10, dataMax + pad)
  const minTrend = Math.max(0, dataMin - pad)
  const trendRange = maxTrend - minTrend || 1

  return (
    <div className="section">
      <div className="section-title">感情のパターン</div>

      {/* Card 1: Heatmap */}
      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
          曜日 × 時間帯 — 普段との差
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12, lineHeight: 1.6 }}>
          あなたの普段 (WBI {baseline.toFixed(1)} ± {stddev.toFixed(1)}) との比較。
          <span style={{ color: '#22c55e' }}> 緑</span>=良い
          <span style={{ color: '#ef4444' }}>赤</span>=悪い
          <span style={{ color: 'var(--text3)' }}>グレー=普段通り</span>
          ・ セルをクリックで詳細
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
                const info = labelFor(avg)
                const count = cellCounts[di][si]
                const clickable = avg !== null
                const tooltipText = avg !== null
                  ? `${DOW_LABELS[di]}${SLOT_LABELS[si]}: ${info.label} (WBI ${avg.toFixed(1)}, ${count}件)`
                  : 'データなし'
                return (
                  <div key={si}
                    title={tooltipText}
                    onClick={() => { if (clickable) setSelectedCell({ dow: di, slot: si }) }}
                    style={{
                      background: info.bg,
                      borderRadius: 5,
                      minHeight: 50,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 2,
                      padding: '4px 2px',
                      color: info.color,
                      cursor: clickable ? 'pointer' : 'default',
                      transition: 'transform .1s',
                    }}
                    onMouseEnter={e => { if (clickable) e.currentTarget.style.transform = 'scale(1.03)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1 }}>{info.label}</div>
                    {count > 0 && (
                      <div style={{ fontSize: 9, opacity: 0.75, lineHeight: 1, fontFamily: 'var(--mono)' }}>
                        {count}件
                      </div>
                    )}
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

        <div style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
          {/* Y-axis labels */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', paddingRight: 4, textAlign: 'right', minWidth: 24, height: 140 }}>
            <span>{maxTrend.toFixed(1)}</span>
            <span style={{ color: 'var(--accent)' }}>{baseline.toFixed(1)}</span>
            <span>{minTrend.toFixed(1)}</span>
          </div>

          <svg viewBox="0 0 400 140" style={{ flex: 1, height: 140 }} preserveAspectRatio="none">
            {/* Baseline horizontal line */}
            <line
              x1={0} x2={400}
              y1={140 - ((baseline - minTrend) / trendRange) * 130 - 5}
              y2={140 - ((baseline - minTrend) / trendRange) * 130 - 5}
              stroke="var(--accent)" strokeWidth="1" strokeDasharray="4 3" opacity="0.5"
            />

            {/* Shaded band for "below baseline" */}
            {trendData.length > 1 && (
              <path
                d={(() => {
                  const pts = trendData.map((d, i) => {
                    const x = (i / (trendData.length - 1)) * 400
                    const y = 140 - ((d.avg7 - minTrend) / trendRange) * 130 - 5
                    return [x, y] as [number, number]
                  })
                  const baseY = 140 - ((baseline - minTrend) / trendRange) * 130 - 5
                  // Build a path that fills only below-baseline regions
                  let d = ''
                  pts.forEach(([x, y], i) => {
                    if (y > baseY) {
                      if (i === 0 || pts[i - 1][1] <= baseY) {
                        d += `M ${x} ${baseY} L ${x} ${y} `
                      } else {
                        d += `L ${x} ${y} `
                      }
                      if (i === pts.length - 1 || pts[i + 1][1] <= baseY) {
                        d += `L ${x} ${baseY} Z `
                      }
                    }
                  })
                  return d
                })()}
                fill="rgba(239, 68, 68, 0.18)"
              />
            )}

            {/* 7-day rolling average line */}
            {trendData.length > 1 && (
              <polyline
                points={trendData.map((d, i) => {
                  const x = (i / (trendData.length - 1)) * 400
                  const y = 140 - ((d.avg7 - minTrend) / trendRange) * 130 - 5
                  return `${x},${y}`
                }).join(' ')}
                fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              />
            )}
          </svg>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)', marginTop: 4, marginLeft: 28, fontFamily: 'var(--mono)' }}>
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
            <OutlierCard
              entry={outliers.low}
              diary={diaryByDate[outliers.low.created_at.substring(0, 10)]}
              events={eventsByDate[outliers.low.created_at.substring(0, 10)]}
              baseline={baseline}
              kind="low"
              fmtJpDate={fmtJpDate}
            />
          )}
          {outliers.high && (
            <OutlierCard
              entry={outliers.high}
              diary={diaryByDate[outliers.high.created_at.substring(0, 10)]}
              events={eventsByDate[outliers.high.created_at.substring(0, 10)]}
              baseline={baseline}
              kind="high"
              fmtJpDate={fmtJpDate}
            />
          )}
        </div>
        {(!outliers.low || !outliers.high) && (
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8, textAlign: 'center' }}>
            直近2週間のデータが不足しています
          </div>
        )}
      </Card>

      {/* Card 4: Event correlation */}
      {(eventPatterns.negative.length > 0 || eventPatterns.positive.length > 0) && (
        <Card style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
            予定との紐付き — 繰り返し現れるパターン
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12 }}>
            3回以上記録がある予定のうち、気分が普段と明確にズレているものだけ。前日の気分（予期的反応）もチェック。
          </div>

          {eventPatterns.negative.length > 0 && (
            <div style={{ marginBottom: eventPatterns.positive.length > 0 ? 16 : 0 }}>
              <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, marginBottom: 8, letterSpacing: '.5px' }}>
                😰 気分が落ちやすい予定
              </div>
              {eventPatterns.negative.map((p, i) => (
                <EventPatternRow key={'n' + i} pattern={p} stddev={stddev} />
              ))}
            </div>
          )}

          {eventPatterns.positive.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: '#22c55e', fontWeight: 600, marginBottom: 8, letterSpacing: '.5px' }}>
                😊 気分が上がりやすい予定
              </div>
              {eventPatterns.positive.map((p, i) => (
                <EventPatternRow key={'p' + i} pattern={p} stddev={stddev} />
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Heatmap cell detail modal */}
      {selectedCell && (
        <HeatmapCellModal
          cell={selectedCell}
          entries={entries}
          diaryByDate={diaryByDate}
          baseline={baseline}
          onClose={() => setSelectedCell(null)}
          dowLabels={DOW_LABELS}
          slotLabels={SLOT_LABELS}
        />
      )}
    </div>
  )
}

// ============================================================
// OutlierCard — Card 3 sub-component with diary context
// ============================================================

function OutlierCard({ entry, diary, events: dayEvents, baseline, kind, fmtJpDate }: {
  entry: EmotionEntry
  diary: DiaryRow | undefined
  events: CalendarEvent[] | undefined
  baseline: number
  kind: 'low' | 'high'
  fmtJpDate: (iso: string) => string
}) {
  const color = kind === 'low' ? '#ef4444' : '#22c55e'
  const bgAlpha = kind === 'low' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(34, 197, 94, 0.08)'
  const icon = kind === 'low' ? '🔻 最低' : '🔺 最高'
  const dev = entry.wbi_score - baseline
  const snippet = diary?.ai_summary || diary?.body?.substring(0, 120) || null
  const events = (dayEvents || []).slice(0, 3)

  return (
    <div style={{ background: bgAlpha, borderLeft: `3px solid ${color}`, padding: '12px 14px', borderRadius: 6 }}>
      <div style={{ fontSize: 10, color, fontWeight: 600, letterSpacing: '.5px', marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'var(--mono)' }}>{entry.wbi_score.toFixed(1)}</div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{fmtJpDate(entry.created_at)}</div>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
        個人平均より <span style={{ color, fontWeight: 600 }}>{dev >= 0 ? '+' : ''}{dev.toFixed(1)}</span>
      </div>

      {/* Calendar context */}
      {events.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
          <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>当日の予定</div>
          {events.map((ev, i) => (
            <div key={i} style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.4 }}>· {ev.summary || '—'}</div>
          ))}
        </div>
      )}

      {/* Diary snippet */}
      {snippet && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
          <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>日記から</div>
          <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5, fontStyle: 'italic' }}>
            「{snippet}{snippet.length >= 120 ? '…' : ''}」
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// HeatmapCellModal — detail list for a specific dow × slot cell
// ============================================================

function HeatmapCellModal({ cell, entries, diaryByDate, baseline, onClose, dowLabels, slotLabels }: {
  cell: { dow: number; slot: number }
  entries: EmotionEntry[]
  diaryByDate: Record<string, DiaryRow>
  baseline: number
  onClose: () => void
  dowLabels: string[]
  slotLabels: string[]
}) {
  // Filter entries matching the cell
  const matching = useMemo(() => {
    return entries.filter(e => {
      if (e.wbi_score <= 0) return false
      const d = new Date(e.created_at)
      if (d.getDay() !== cell.dow) return false
      const h = d.getHours()
      let slot = 0
      if (h >= 5 && h < 11) slot = 0
      else if (h >= 11 && h < 16) slot = 1
      else if (h >= 16 && h < 20) slot = 2
      else slot = 3
      return slot === cell.slot
    }).sort((a, b) => b.created_at.localeCompare(a.created_at))
  }, [entries, cell])

  const cellAvg = matching.length > 0
    ? matching.reduce((s, e) => s + e.wbi_score, 0) / matching.length
    : 0
  const dev = cellAvg - baseline

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 12, width: '90%', maxWidth: 560,
        maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        border: '1px solid var(--border)',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                {dowLabels[cell.dow]}曜日 × {slotLabels[cell.slot]}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                {matching.length}件の記録 · 平均 <span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{cellAvg.toFixed(1)}</span>
                {' '}(個人平均より <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: dev >= 0 ? '#22c55e' : '#ef4444' }}>
                  {dev >= 0 ? '+' : ''}{dev.toFixed(1)}
                </span>)
              </div>
            </div>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer',
              fontSize: 20, padding: 0, lineHeight: 1,
            }}>×</button>
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {matching.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: 24 }}>
              データがありません
            </div>
          )}
          {matching.map((e, i) => {
            const day = e.created_at.substring(0, 10)
            const diary = diaryByDate[day]
            const d = new Date(e.created_at)
            const md = `${d.getMonth() + 1}/${d.getDate()}`
            const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
            const entryDev = e.wbi_score - baseline
            const entryColor = entryDev >= 0 ? '#22c55e' : '#ef4444'
            const snippet = diary?.ai_summary || diary?.body?.substring(0, 100)
            return (
              <div key={i} style={{
                padding: '10px 0',
                borderBottom: i < matching.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', minWidth: 55 }}>
                    {md} {hm}
                  </span>
                  <span style={{
                    fontSize: 13, fontWeight: 700, color: entryColor, fontFamily: 'var(--mono)', minWidth: 32,
                  }}>
                    {e.wbi_score.toFixed(1)}
                  </span>
                  <span style={{ fontSize: 10, color: entryColor }}>
                    ({entryDev >= 0 ? '+' : ''}{entryDev.toFixed(1)})
                  </span>
                </div>
                {snippet && (
                  <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5, paddingLeft: 65 }}>
                    {snippet}{snippet.length >= 100 ? '…' : ''}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// EventPatternRow — single row in Card 4
// ============================================================

interface EventPattern {
  display: string
  kind: 'category' | 'type' | 'event'
  count: number
  avgDay: number
  avgPrev: number | null
  dayDev: number
  prevDev: number | null
}

const KIND_BADGE: Record<EventPattern['kind'], { label: string; color: string; bg: string }> = {
  category: { label: 'カテゴリ', color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.15)' },
  type:     { label: '種類',     color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
  event:    { label: '個別',     color: 'var(--text3)', bg: 'var(--surface2)' },
}

function EventPatternRow({ pattern, stddev }: { pattern: EventPattern; stddev: number }) {
  const p = pattern
  const dayColor = p.dayDev < 0 ? '#ef4444' : '#22c55e'
  const prevSignificant = p.prevDev !== null && Math.abs(p.prevDev) >= 0.5 * stddev
  const prevColor = p.prevDev !== null && p.prevDev < 0 ? '#ef4444' : '#22c55e'
  const badge = KIND_BADGE[p.kind]

  // Semantic label
  const zDay = p.dayDev / stddev
  const dayLabel = Math.abs(zDay) >= 1.5 ? (zDay > 0 ? 'とても良い' : 'とても悪い')
    : Math.abs(zDay) >= 1.0 ? (zDay > 0 ? '良い' : '悪い')
    : (zDay > 0 ? 'やや良い' : 'やや悪い')

  return (
    <div style={{
      padding: '10px 12px',
      marginBottom: 6,
      background: p.dayDev < 0 ? 'rgba(239, 68, 68, 0.06)' : 'rgba(34, 197, 94, 0.06)',
      borderLeft: `3px solid ${dayColor}`,
      borderRadius: 5,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{
              fontSize: 9,
              fontWeight: 600,
              padding: '1px 6px',
              borderRadius: 3,
              background: badge.bg,
              color: badge.color,
              letterSpacing: '.3px',
              flexShrink: 0,
            }}>{badge.label}</span>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.display}
            </div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text3)' }}>
            {p.count}回のパターン
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: dayColor }}>
            当日 {dayLabel}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
            WBI {p.avgDay.toFixed(1)} ({p.dayDev >= 0 ? '+' : ''}{p.dayDev.toFixed(1)})
          </div>
        </div>
      </div>

      {prevSignificant && p.prevDev !== null && p.avgPrev !== null && (
        <div style={{
          marginTop: 6,
          paddingTop: 6,
          borderTop: '1px dashed var(--border)',
          fontSize: 10,
          color: 'var(--text3)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span style={{ color: prevColor, fontWeight: 600 }}>↳ 前日から</span>
          <span>気分が</span>
          <span style={{ color: prevColor, fontWeight: 600 }}>
            {p.prevDev < 0 ? '既に落ち込んでいる' : '上向いている'}
          </span>
          <span style={{ fontFamily: 'var(--mono)', marginLeft: 'auto' }}>
            前日WBI {p.avgPrev.toFixed(1)} ({p.prevDev >= 0 ? '+' : ''}{p.prevDev.toFixed(1)})
          </span>
        </div>
      )}
    </div>
  )
}

// React.Fragment import
import React from 'react'
