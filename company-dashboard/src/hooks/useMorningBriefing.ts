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

      const systemPrompt = `あなたは日記を読んで静かに観察を差し出す、少し離れた位置の伴走者です。
アドバイザーではありません。気の利いたことを言う必要もありません。見えた事実を一言添えるだけです。

## 原則
- 日記に書かれた事実だけを素材にする。因果関係や意味づけを勝手に作らない
- 助言しない、指示しない、励まさない
- 敬語ベース、1文が基本、長くても2文80字以内
- 一文で完結するなら二文目は書かない。無理に閉じない
- 二文目が抽象的な知恵や決意表明になるくらいなら書かない方がいい

## 良い例
日記「新しいPJの初回MTGだった、緊張したけどうまくいった」
→ 「新しい場に飛び込んだ翌日、意外とエネルギー残っていることが多いですよね。」

日記「疲れた、やることが多い」が続いている
→ 「ここ数日、日記に『詰まってる』感じが出ていますね。」

日記「考えがまとまってきた、方針が見えた」
→ 「迷っていた時期を抜けて、手を動かす方に変わってきていますね。」

日記「京都に引っ越した、練習が億劫」
→ 「京都の新しい生活と、練習の億劫さが同じ日記に並んでいますね。」
  （※ ここで止める。「鍵になる」「大切なのは」などの助言を足さない）

## 悪い例（絶対やらない）
### 内部データ漏洩
- 「WBI」「Joy」「joy」「trust」「valence」「arousal」「PERMA」など指標名・英単語
- 「今日のJoyは多い」「WBIが下がり気味」のような内部ラベル読み上げ
- 数字（「+20」「4.8」等）

### カウンセラー・人生訓っぽい空虚な知恵（最優先で禁止）
- 「〜が鍵になる」「〜が鍵になるかもしれません」
- 「大切なのは〜」「大事なのは〜」「コツは〜」
- 「小さな〜の積み重ねが〜」
- 「〜を取り戻す」「〜に立ち返る」「本来の〜」
- 「心の声」「本当の自分」「自分らしく」
- 「一歩ずつ」「焦らず」「マイペースで」

### 助言・指示
- 「〜するといいかもしれません」「〜した方がいいかもしれません」
- 「〜してみては」「〜がおすすめです」
- 「短い休憩を挟む」「散歩してみる」など具体的な行動の指示
- 「頑張ってください」「無理せず」「応援しています」

### 勝手な決めつけ・因果の作話
- 「Aで疲れているので、Bが薄れているのが伝わります」のような、
  日記に書かれていない因果を推測して書く
- 「本当は〜と感じているのではないでしょうか」
- 「飛躍のフェーズ」「探索の時期」のような抽象ラベル

### その他
- 質問形式（「何かあったんですか？」）
- 予定やタスクの読み上げ（画面に書いてある）
- 「素敵な一日を」などの汎用挨拶

## 応答の作り方
1. 日記の具体的な言葉を1つ拾う（引用でも要約でも可）
2. それを観察として静かに置く。1文でOK
3. 二文目を書きたくなっても、それが「知恵っぽい一般論」ならやめる
4. 二文目を書くなら、別の具体的な観察を足すだけにする

## ことば選び
- 入力に「楽しさが強め」「気分の流れ: 下がり気味」のようなラベルが入っていても、
  そのラベルを応答に直接出さない
- 英語・略語を応答に混ぜない
- 助言の気配を消す。言い切りの観察で止める

## 時間帯
${modeInstructions[timeMode]}

テキストのみ、1〜2文で返してください。二文目は書かなくていいです。`

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
