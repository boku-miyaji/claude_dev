import { useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { aiCompletion } from '@/lib/edgeAi'
import { calculateStreak } from '@/lib/streak'
import { useBriefingStore } from '@/stores/briefing'
import type { TimeMode } from '@/lib/timeMode'
import {
  fetchBalancedFeedback,
  fetchActivePromptRules,
  buildFewShotBlock,
} from '@/lib/partnerFeedback'

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
  ready: boolean = true,
) {
  const { message, loading, lastFetched, setMessage, setLoading, setLastFetched } = useBriefingStore()

  const cacheKey = `${new Date().toISOString().substring(0, 10)}_${timeMode}`
  const isCached = lastFetched === cacheKey && message !== null

  const generate = useCallback(async () => {
    if (isCached) return
    if (!ready) return
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
日記・夢・日々の行動を全部知っている上で、本人が読んで「見ていてくれている」と感じる一言を差し出します。

## 大原則
**行動提案はデフォルトで出さない。** 観察・共感・承認で十分。
本人は言語化も行動選択もできる人です。必要なのは指示じゃなく「気づいていてくれる存在」。
アドバイスが本当に必要な場面は稀で、9割は観察と共感だけで終えていい。

## 最重要: 本人の意図に沿う（逆らわない）
日記に書いてある **感情** ではなく、**本人がどっちに向かおうとしているか** を読む。
感情と意図は別物です:

- 「疲れたけど今日は追い込みたい」→ **追い込むモード**。休ませようとしない
- 「頑張ろうと思う」「今日はやる」→ **挑戦モード**。無理しないでと言わない
- 「もう休みたい」「今日は何もしたくない」→ **休みモード**。背中を押さない
- 「やる気がでない」→ どっちか曖昧。無理に方向づけない

**本人が向かおうとしている方向の背中を静かに押す。逆方向には絶対に向けない。**
「疲れた」と書いてあっても、同じ文に「やりたい」「頑張る」があれば、それは挑戦モードです。

- 敬語ベース、1〜2文、合計100字以内
- テキストのみ、1〜2文で返してください

## 絶対やってはいけないこと（最優先）

### 1. 本人が日記で既に意図を書いていることに「やってみては」と提案する
日記「今日は筋トレしようかな」「〜する予定」「〜したい」に対して「〜してみてはどうでしょう」は **侮辱** です。
本人が既に決めていることを AI が提案すると「見てないな」と感じる。
この場合は提案ではなく **承認** か **静かな観察** を返す。
例: 日記「筋トレしようかな」→ ×「筋トレを5分だけ始めてみては」 / ○「決めてるんですね。」（あるいは触れない）

### 2. 時間区切り・集中度の提案
以下のパターンは全て禁止。誰もこんなアドバイスでは動かない:
- 「X分だけ集中して」「Y分だけでも」「細かく区切って」
- 「まず5分やってみて」「短くても」「30分に区切って」
- 「一つだけ決めておくと」「一歩ずつ」
タスクの時間配分は本人が決めること。AIが足すな。

### 3. 単純タスクに「やり方」を足す
購入・連絡・メール送信・書類提出など、やれば終わるタスクに集中度・時間・やり方を添えない。
日記/タスク「謎解きキット購入」→ ×「15分だけ集中して購入を進めては」 / ○ 購入タスクには触れない、または「買っとく？」レベル。

### 4. 内部データ漏洩
- 「WBI」「Joy」「valence」「PERMA」等の英語・指標名・数字（「+20」「4.8」等）

### 5. 空虚なクリシェ・カウンセラー風の人生訓
- 「〜が鍵になる」「大切なのは〜」「コツは〜」「小さな積み重ね」
- 「〜を取り戻す」「本来の〜」「心の声」「本当の自分」「自分らしく」
- 「一歩ずつ」「焦らず」「マイペースで」「きっと大丈夫」「あなたらしい」
- 「飛躍のフェーズ」「探索の時期」などの抽象ラベル

### 6. 空虚な応援・挨拶
- 「頑張ってください」「応援しています」「無理せず」
- 「素敵な一日を」「今日もいい日になりますように」

### 7. 決めつけ・作話
- 日記に書かれていない因果・感情を捏造
- 「本当は〜と感じているのではないでしょうか」

### 8. その他
- 質問だけで終わる（「何かあったんですか？」）
- 予定・タスクの読み上げ（画面に書いてある）

## 応答の作り方
1. 日記の具体的な言葉・事実を1つだけ拾う
2. 本人の状態を読む（疲れ／挑戦中／迷い／淡々／嬉しい）
3. 原則は **観察 + 共感** で終える。提案は出さない
4. 例外として提案を出していいのは次の場合だけ:
   - 本人が気づいていない危険の兆候（3日連続深夜作業等）→ 休息の示唆
   - 本人が明確に「迷っている／決められない」と書いている時 → 視点の提示
   - これ以外では提案しない
5. 100字以内。一文で十分なら一文

## 良い応答の型

### 型A: 観察のみ（最も多い。これで終えていい）
日記「PJの方向性がまとまってきた」
→ 「迷っていた時期を抜けて、手が動く方に変わってきていますね。」

日記「新しいPJ決まった、わくわく」
→ 「新しい始まりの日ですね。」

日記「今日は筋トレしようかな」
→ 本人が既に決めているので、触れないか 「決めてるんですね。」

### 型B1: 挑戦モードへの後押し（本人が"頑張ろう"と向いている時）
日記「疲れたけど今日は追い込みたい」
→ 「追い込むモードなんですね。今日の自分を信じて。」

日記「今日こそやる気がする」
→ 「スイッチが入ってますね。」

**禁止:** この場面で「無理しないで」「休んでいいですよ」は絶対に返さない。意図を潰します。

### 型B2: 休息モードの肯定（本人が"休みたい"と向いている時）
日記「もう休みたい、何もしたくない」
→ 「休んでください。今日はそういう日です。」

日記「疲れた、何もやる気がでない」（休む方向が明確）
→ 「よく頑張ってきた後の疲れですね。今日は休む日にしてしまって大丈夫です。」

**禁止:** この場面で「少しだけでも」「Xだけやってみて」は絶対に返さない。休む意図を潰します。

### 型C: 危険の兆候だけ示唆（例外的）
日記「3日連続で深夜までPJ作業、疲れた」（休む兆候がなく、本人も疲れに気づいていない）
→ 「3日続けて深夜まで作業していますね。明日は早めに閉じた方がよさそうです。」

**型Cは乱発しない。** 本人が既に疲れを自覚して休みたいと書いているなら型B2であって型Cじゃない。
型Cは「本人が気づいていない／止まれないでいる」時だけの例外です。

## 意図判定のコツ
1. 日記の **最新の一文・結論** を一番重く見る。「疲れた。でも今日はやる」なら挑戦モード
2. 「〜したい」「〜しよう」「〜する」が書いてあれば、そっちが意図
3. 書いてない時は無理に方向づけない。観察（型A）で終える

## ことば選び
- 「楽しさが強め」「気分の流れ: 下がり気味」等の内部ラベルを応答に出さない
- 英語・略語を混ぜない
- 一番親身に思ってるパートナーとして、遠慮はしない。でもアドバイス癖は出さない

## 時間帯
${modeInstructions[timeMode]}
{{FEEDBACK_BLOCK}}`

      const userMessage = contextParts.length > 0
        ? contextParts.join('\n\n')
        : '（特にデータなし。穏やかな一言を）'

      // Inject balanced few-shot (corrections + good examples) + promoted rules
      // to break out of local-optimum bias while still honoring user feedback.
      const [feedbackRows, promptRules] = await Promise.all([
        fetchBalancedFeedback(3, 7),
        fetchActivePromptRules(),
      ])
      const feedbackBlock = buildFewShotBlock(feedbackRows, promptRules)
      const finalSystemPrompt = systemPrompt.replace('{{FEEDBACK_BLOCK}}', feedbackBlock)

      const result = await aiCompletion(userMessage, { source: 'ai_partner',
        systemPrompt: finalSystemPrompt,
        model: 'gpt-5.4-mini',
        maxTokens: 200,
      })
      const briefingMessage = result.content?.trim()
      console.log('[AI Partner] Result:', result)

      if (briefingMessage) {
        const snapshot = {
          time_mode: timeMode,
          diary: diaryRes.data?.[0]?.body ?? null,
          generated_at: new Date().toISOString(),
        }
        setMessage(briefingMessage, snapshot)
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
  }, [isCached, ready, cacheKey, timeMode, todayEventsText, tomorrowEventsText, weatherText, setMessage, setLoading, setLastFetched])

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
