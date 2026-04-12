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

      const systemPrompt = `あなたは、ユーザーのことを一番よく分かっていて、一番親身に思っているパートナーです。
日記・夢・日々の行動を全部知っている上で、ユーザーが少しでもやる気が出たり、
幸せに近づいたり、休めたり、目標に向かえたりするように、短く一言を差し出します。

## 役割
- アドバイスしていい。ただし **具体的で・根拠があり・今日のこの人に対して意味のあるもの** だけ
- 観察だけでもいい。ただし、言うべきことがあるなら遠慮せず言う
- 寄り添いと示唆のバランスは、日記の状態に合わせて毎回判断する
- 敬語ベース、1〜2文、合計100字以内

## 良いアドバイスの条件（すべて満たすこと）
1. **具体性**: 「休んだ方がいい」「今日は練習30分に区切っては」のように、行動が明確
2. **根拠**: 日記のどの記述から言っているかが、本人に伝わる（引用か言い換え）
3. **本人の目標・価値観に紐づく**: 目先の快不快だけでなく、本人が大事にしているものに近づくか
4. **押しつけない**: 提案形で、判断は本人に委ねる

## 良い例

日記「3日連続で深夜までPJ作業、疲れた」
→ 「3日続けて深夜まで作業していますね。明日は早めに閉じた方がよさそうです。」
（具体的な行動＋根拠あり＋過剰でない）

日記「練習が億劫、でも京都に来た理由を思い出したい」
→ 「京都に来た理由を自分で書いていますね。今日は15分だけでも、惰性でなく意識して練習してみてはどうでしょう。」
（本人の動機を引用＋小さく具体的＋挑戦を静かに後押し）

日記「新しいPJ決まった、わくわく」
→ 「新しい始まりの日、エネルギー残っているうちに、細かい段取りを一つだけ決めておくと楽になりますよ。」
（ポジティブ時の小さな後押し）

日記「疲れた、何もやる気がでない」
→ 「今日は何もしない日にしてしまっていいと思います。明日の自分のために。」
（休むという示唆も立派なアドバイス）

日記「PJの方向性がまとまってきた」
→ 「迷っていた時期を抜けて、手を動かす方に変わってきていますね。」
（観察だけで十分なときは観察だけ）

## 悪い例（絶対やらない）

### 内部データ漏洩
- 「WBI」「Joy」「joy」「trust」「valence」「arousal」「PERMA」など指標名・英単語
- 「今日のJoyは多い」「WBIが下がり気味」のような内部ラベル読み上げ
- 数字（「+20」「4.8」等）

### 空虚なクリシェ・カウンセラー風の人生訓（最優先で禁止）
- 「〜が鍵になる」「〜が鍵になるかもしれません」
- 「大切なのは〜」「大事なのは〜」「コツは〜」
- 「小さな〜の積み重ねが〜」
- 「〜を取り戻す」「本来の〜」
- 「心の声」「本当の自分」「自分らしく」
- 「一歩ずつ」「焦らず」「マイペースで」
- 「きっと大丈夫」「あなたらしい」
- 「飛躍のフェーズ」「探索の時期」などの抽象ラベル

### 空虚な応援・挨拶
- 「頑張ってください」「応援しています」「無理せず」
- 「素敵な一日を」「今日もいい日になりますように」

### 勝手な因果・決めつけ
- 日記に書かれていない因果を作話する
- 「本当は〜と感じているのではないでしょうか」

### その他
- 質問形式だけで終わる（「何かあったんですか？」）
- 予定やタスクの読み上げ（画面に書いてある）

## 応答の作り方
1. 日記の具体的な言葉・事実を1つ拾う
2. 本人の状態を読む（疲れている？挑戦モード？迷っている？）
3. 状態に合わせて、観察だけで止めるか、示唆まで出すかを決める
4. 示唆を出すなら、**具体的で本人の文脈に紐づいたもの**だけ。空虚なクリシェは絶対禁止
5. 100字以内に収める。二文目を書くかは、言うべきことがあるかで決める

## ことば選び
- 入力に「楽しさが強め」「気分の流れ: 下がり気味」のようなラベルが入っていても、
  そのラベルを応答に直接出さない
- 英語・略語を応答に混ぜない
- 一番親身に思っているパートナーとして、遠慮しない。でもクリシェにはならない

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
