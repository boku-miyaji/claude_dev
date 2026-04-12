import { useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { aiCompletion } from '@/lib/edgeAi'
import { calculateStreak } from '@/lib/streak'
import { useBriefingStore } from '@/stores/briefing'
import type { TimeMode } from '@/lib/timeMode'

/** Plutchik keys */
const PLUTCHIK_KEYS = ['joy', 'trust', 'fear', 'surprise', 'sadness', 'disgust', 'anger', 'anticipation'] as const

/** Plutchik → 日本語ラベル（応答に内部英語名が漏れるのを防ぐ） */
const PLUTCHIK_JP: Record<string, string> = {
  joy: '楽しさ',
  trust: '安心感',
  fear: '不安',
  surprise: '驚き',
  sadness: '寂しさ',
  disgust: 'いらだち',
  anger: '怒り',
  anticipation: '期待',
}

/**
 * Deep-personalized AI comment for Today screen.
 * Injects diary emotions, WBI trends, CEO insights, work rhythm,
 * calendar context, tasks, dreams, and streak data into the prompt.
 */
export function useMorningBriefing(
  timeMode: TimeMode,
  todayEventsText?: string,
  tomorrowEventsText?: string,
  weatherText?: string,
) {
  const { message, loading, lastFetched, setMessage, setLoading, setLastFetched } = useBriefingStore()

  const cacheKey = `${new Date().toISOString().substring(0, 10)}_${timeMode}`
  const isCached = lastFetched === cacheKey && message !== null

  const generate = useCallback(async () => {
    if (isCached) return
    setLoading(true)

    try {
      // Collect all context data in parallel
      const [diaryRes, emotionRes, tasksRes, dreamsRes, insightsRes, , streakResult] = await Promise.all([
        supabase
          .from('diary_entries')
          .select('body, wbi, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('emotion_analysis')
          .select('joy, trust, fear, surprise, sadness, disgust, anger, anticipation, valence, arousal, wbi_score, created_at')
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('tasks')
          .select('title, status, due_date, completed_at')
          .in('status', ['open', 'done'])
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('dreams')
          .select('title, status')
          .in('status', ['active', 'in_progress'])
          .limit(5),
        supabase
          .from('ceo_insights')
          .select('insight, category')
          .in('category', ['preference', 'tendency', 'work_rhythm', 'pattern'])
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('prompt_log')
          .select('created_at')
          .order('created_at', { ascending: false })
          .limit(50),
        calculateStreak(),
      ])

      // Build emotion context（内部英語名は一切使わない。日本語ラベルのみ）
      let emotionContext = ''
      if (emotionRes.data && emotionRes.data.length > 0) {
        const avg: Record<string, number> = {}
        const count = emotionRes.data.length
        for (const e of emotionRes.data) {
          for (const key of PLUTCHIK_KEYS) {
            avg[key] = (avg[key] ?? 0) + ((e as Record<string, number>)[key] ?? 0)
          }
        }
        let dominant = 'joy'
        let maxVal = 0
        for (const key of PLUTCHIK_KEYS) {
          avg[key] = avg[key] / count
          if (avg[key] > maxVal) { maxVal = avg[key]; dominant = key }
        }
        emotionContext = `直近の気持ちの傾向: ${PLUTCHIK_JP[dominant]}が強め`
      }

      // 気分の流れ（直近7日）。数値や指標名は出さず、方向だけ伝える
      let moodTrend = ''
      if (diaryRes.data && diaryRes.data.length >= 2) {
        const wbis = diaryRes.data.filter((d) => d.wbi != null).map((d) => d.wbi as number)
        if (wbis.length >= 2) {
          const recent = wbis[0]
          const prev = wbis.slice(1).reduce((a, b) => a + b, 0) / (wbis.length - 1)
          const diff = recent - prev
          const direction = diff > 0.5 ? '上向き' : diff < -0.5 ? '下がり気味' : '落ち着いている'
          moodTrend = `気分の流れ: ${direction}`
        }
      }

      // Recent diary
      const recentDiary = diaryRes.data
        ?.slice(0, 3)
        .map((e) => `[${e.created_at.substring(0, 10)}] ${(e.body ?? '').substring(0, 100)}`)
        .join('\n') || ''

      // CEO insights
      const insightsText = insightsRes.data
        ?.map((i) => `[${(i as { category: string }).category}] ${(i as { insight: string }).insight}`)
        .join('\n') || ''

      // Tasks
      const openTasks = (tasksRes.data || []).filter((t) => t.status === 'open')

      // Dreams
      const dreamsText = dreamsRes.data
        ?.map((d) => `${d.title} (${d.status})`)
        .join(', ') || ''

      // Build the context block — diary is primary, everything else is supporting
      const now = new Date()
      const currentTime = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`
      const contextParts: string[] = []

      // ① Primary: diary (what the user is feeling / thinking)
      if (recentDiary) contextParts.push(`【日記（最重要）】\n${recentDiary}`)
      if (emotionContext) contextParts.push(emotionContext)
      if (moodTrend) contextParts.push(moodTrend)

      // ② Atmosphere: weather, time
      const atmosphereParts: string[] = [`時刻: ${currentTime}`]
      if (weatherText) atmosphereParts.push(weatherText)
      contextParts.push(`【今日の空気】\n${atmosphereParts.join(' / ')}`)

      // ③ Supporting context (don't mention directly, use to deepen understanding)
      const supportParts: string[] = []
      if (todayEventsText) supportParts.push(`予定:\n${todayEventsText}`)
      if (tomorrowEventsText) supportParts.push(`明日: ${tomorrowEventsText}`)
      if (openTasks.length > 0) {
        supportParts.push(`抱えてるタスク: ${openTasks.slice(0, 3).map((t) => t.title).join('、')}`)
      }
      if (supportParts.length > 0) {
        contextParts.push(`【補足（直接言及しなくていい）】\n${supportParts.join('\n')}`)
      }

      if (insightsText) contextParts.push(`【この人の傾向】\n${insightsText}`)
      if (dreamsText) contextParts.push(`進行中の夢: ${dreamsText}`)
      if (streakResult > 0) contextParts.push(`連続記録: ${streakResult}日`)

      // Time-mode specific instructions
      const modeInstructions: Record<TimeMode, string> = {
        morning: `朝。今日どんな一日になりそうかの空気感を一言で。`,
        afternoon: `昼。午前を踏まえた、さりげない一言。`,
        evening: `夜。今日一日を踏まえた、労いや共感の一言。`,
      }

      const systemPrompt = `あなたは日記の内容から静かに気づきを差し出す、少し離れた位置の伴走者です。

## 原則
- 日記に書かれた事実をベースにする。事実がない推測はしない
- 「あなたは〜ですね」ではなく、気づきを差し出す形で
- 丁寧だけど堅くない、です・ます調
- 1〜2文、80字以内

## 良い例
日記に「新しいPJの初回MTGだった」「緊張したけどうまくいった」とあった場合:
→ 「新しい場に飛び込んだ日の翌日って、意外とエネルギー高いことが多いですよね。」

日記に「疲れた」「やることが多い」が続いている場合:
→ 「ここ数日、詰まってる感じが日記に出ていますね。」

日記に「考えがまとまってきた」「方針が見えた」とあった場合:
→ 「迷っていた時期を抜けて、手を動かす方に変わってきていますね。」

## 悪い例（絶対やらない）
- 「素敵な一日を」「無理せず」「頑張りましょう」（汎用的）
- 「WBI」「Joy」「joy」「trust」「valence」「arousal」「PERMA」など内部の指標名・英単語を出す
- 「今日のJoyは多い」「WBIが下がり気味」のような、内部データをそのまま読み上げる文
- 数字を見せる（「+20」「4.8」等）
- 「何かあったんですか？」のような質問形式
- 「飛躍のフェーズですね」「探索の時期です」のような抽象ラベル
- 「〜するといいかもしれません」「〜した方がいいかもしれません」などの行動提案・アドバイス
- 「短い休憩を挟むと」「散歩してみては」のような指示
- 予定やタスクを読み上げる（画面に書いてある）

## ことば選び
- 入力に「楽しさが強め」「気分の流れ: 下がり気味」のようなラベルが入っていても、
  そのラベルを応答に直接出さない。日記の文脈から自然な日本語で言い換える
- 「Joy」「WBI」など英語や略語は絶対に応答に混ぜない
- 提案や指示はしない。観察と共感だけで止める

## 時間帯
${modeInstructions[timeMode]}

テキストのみ、1〜2文で返してください。`

      const userMessage = contextParts.length > 0
        ? contextParts.join('\n\n')
        : '（特にデータなし。穏やかな一言を）'

      const result = await aiCompletion(userMessage, { source: 'ai_partner',
        systemPrompt,
        maxTokens: 200,
      })
      const briefingMessage = result.content?.trim()
      console.log('[AI Partner] Result:', result)

      if (briefingMessage) {
        setMessage(briefingMessage)
        setLastFetched(cacheKey)
      } else {
        // Don't cache fallback — retry on next render
        setMessage(getFallback(timeMode))
      }
    } catch (err) {
      console.error('[AI Partner] Briefing error:', err)
      // Don't cache error fallback — retry on next render
      setMessage(getFallback(timeMode))
    } finally {
      setLoading(false)
    }
  }, [isCached, cacheKey, timeMode, todayEventsText, tomorrowEventsText, weatherText, setMessage, setLoading, setLastFetched])

  useEffect(() => {
    generate()
  }, [generate])

  return { message, loading }
}

function getFallback(mode: TimeMode): string {
  switch (mode) {
    case 'morning': return '今日も穏やかに始めましょう。'
    case 'afternoon': return '午後もあなたのペースで。'
    case 'evening': return '今日も一日、おつかれさまでした。'
  }
}
