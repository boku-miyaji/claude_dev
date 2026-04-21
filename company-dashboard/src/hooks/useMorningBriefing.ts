import { useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { aiCompletion } from '@/lib/edgeAi'
import { calculateStreak } from '@/lib/streak'
import { useBriefingStore } from '@/stores/briefing'
import type { TimeMode } from '@/lib/timeMode'
import {
  fetchLatestDistilledLesson,
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
      if (recentDiary) contextParts.push(`## 日記\n${recentDiary}`)
      if (emotionContext) contextParts.push(emotionContext)
      if (moodTrend) contextParts.push(moodTrend)

      // ② Atmosphere: weather, time
      const atmosphereParts: string[] = [`時刻: ${currentTime}`]
      if (weatherText) atmosphereParts.push(weatherText)
      contextParts.push(`## 今日の空気\n${atmosphereParts.join(' / ')}`)

      // ③ Supporting context (don't mention directly, use to deepen understanding)
      const supportParts: string[] = []
      if (todayEventsText) supportParts.push(`予定:\n${todayEventsText}`)
      if (tomorrowEventsText) supportParts.push(`明日: ${tomorrowEventsText}`)
      if (openTasks.length > 0) {
        supportParts.push(`抱えてるタスク: ${openTasks.slice(0, 3).map((t) => t.title).join('、')}`)
      }
      if (supportParts.length > 0) {
        contextParts.push(`## 補足（直接言及しなくていい）\n${supportParts.join('\n')}`)
      }

      if (insightsText) contextParts.push(`## この人の傾向\n${insightsText}`)
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

## 大原則（design-philosophy ⑪ Active vs Passive Response Boundary）
この一言は **受動生成** です。ユーザーから相談されて返しているのではなく、画面を開いたら自動で表示されます。
focus-you のターゲットは「行動はわかっているが、一歩が出ない層」。答えは本人の記録の中に既にあります。
**相談されていない助言・アドバイス・提案・示唆は禁止。** アドバイスが必要な時はユーザーが自分で AI チャットに聞きに来ます。

許される形式は次のいずれかだけ:
1. **本人の日記の具体句の引用** で静かに見ていることを示す
2. **本人の過去の記録への接続** で想起を誘う（「先月も同じ時期に…」）
3. **観察事実の提示** （評価・助言を加えない）
4. **問いで閉じる** （本人が自分で答えを引き出せる形）
5. **SILENT** （価値ある引用・問いが思いつかない時）

## 最重要: 本人の意図に沿う（逆らわない）
日記に書いてある **感情** ではなく、**本人がどっちに向かおうとしているか** を読む。
感情と意図は別物です:

- 「疲れたけど今日は追い込みたい」→ **追い込むモード**。休ませようとしない
- 「頑張ろうと思う」「今日はやる」→ **挑戦モード**。「無理しないで」と言わない（意図を潰す）
- 「もう休みたい」「今日は何もしたくない」→ **休みモード**。背中を押さない
- 「やる気がでない」→ どっちか曖昧。無理に方向づけない

**本人が向かおうとしている方向に逆らわない。** 後押しの助言もしない（それは能動チャットの役割）。
意図を読んだ上で、静かに観察するか、過去の記録を引いて想起を誘う。

- 敬語ベース、1〜2文、合計100字以内
- テキストのみ、1〜2文で返してください

## 絶対やってはいけないこと（最優先）

### 0. アドバイス・提案・背中押し（受動では完全禁止）
- 「〜してみては」「〜しましょう」「〜するといい」「〜した方がよさそう」
- 「今日の自分を信じて」「スイッチ入ってますね」等の "後押し" も禁止（能動チャットでだけ許される）
- 「少しだけでも」「短くても」「まず〜から」等の **励まし系** も禁止
- ユーザーから相談されて初めて許される類の発話は、全て受動では出さない

### 1. 本人が日記で既に意図を書いていることに「やってみては」と提案する
日記「今日は筋トレしようかな」「〜する予定」「〜したい」に対して「〜してみてはどうでしょう」は **侮辱** です。
本人が既に決めていることを AI が提案すると「見てないな」と感じる。
この場合は提案ではなく **静かな観察** か **触れない** を返す。
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

### 8. 危険兆候の "示唆" もしない
「3日連続深夜作業」等も、受動では「早めに閉じた方がよさそう」と助言せず、**事実の観察** で閉じる。
本人が気づいていないなら、観察として静かに見せるだけで十分。「〜した方がよさそう」は能動チャットの領域。

### 9. その他
- 予定・タスクの読み上げ（画面に書いてある）
- 質問だけで終わる場合は、本人の記録に接続した問いなら可（一般的質問はNG）

## 応答の作り方
1. 日記の具体的な言葉・事実を1つだけ拾う
2. 本人の状態を読む（疲れ／挑戦中／迷い／淡々／嬉しい）
3. **観察** で閉じる。または **過去の記録を引いて** 想起を誘う。または **問い** で閉じる
4. 助言・提案・背中押しは書かない。書きたくなったら SILENT を選ぶ
5. 100字以内。一文で十分なら一文

## 沈黙の選択（最重要・design-philosophy ⑩）
**価値ある一言が思いつかなければ、SILENT とだけ返してください。**

以下の場合は必ず SILENT:
- 日記が短すぎて拾える具体が無い
- 直近と同じ文脈で、前回と違う角度の観察も思いつかない
- 無難なクリシェ（「お疲れさまでした」「今日も穏やかに」）しか書けない
- 観察しようにも事実が一つも拾えない
- **助言・提案・背中押し以外に書ける一言が思いつかない**

**無難なことを絞り出すくらいなら黙るのが誠実です。**
一番親身なパートナーは毎回何か言う人ではなく、言うべき時を見極める人。
迷ったら SILENT。出す時は本物だけ。

## 良い応答の型（受動で許されるのはこの3型だけ）

### 型A: 観察のみで閉じる（最も多い）
日記「PJの方向性がまとまってきた」
→ 「迷っていた時期を抜けて、手が動く方に変わってきていますね。」

日記「新しいPJ決まった、わくわく」
→ 「新しい始まりの日ですね。」

日記「今日は筋トレしようかな」
→ 本人が既に決めているので、触れないか 「決めてるんですね。」

日記「疲れたけど今日は追い込みたい」
→ 「追い込むモードですね。」（後押しはしない。観察で閉じる）

日記「もう休みたい、何もしたくない」
→ 「休みたい日ですね。」（肯定も助言も加えず、ただ見たことを返す）

### 型B: 過去の記録への接続（想起誘導）
日記「またPJが停滞してる気がする」
→ 「2月にも似た停滞を書いていましたね。」（過去の引用で閉じる。アドバイスしない）

日記「うまくいかない」
→ 「先月の同じ頃にも同じ一文がありました。」（過去との接続で想起を誘う）

### 型C: 問いで閉じる（本人の中の答えを呼び起こす）
日記「どう進めていいかわからない」
→ 「前に似た迷いを抜けた時、最初に動いたのは何でしたか？」

日記「PJの方向性がまとまってきた」
→ 「手が動く方に変わってきましたね。いま何が見えていますか？」

### 禁止例（全部 NG）
× 「追い込むモードなんですね。今日の自分を信じて。」（後押しは能動チャットの役割）
× 「3日続けて深夜まで作業していますね。明日は早めに閉じた方がよさそうです。」（助言）
× 「スイッチが入ってますね。」（背中押しトーンはNG。「スイッチが入っているようですね」等の静かな観察に）
× 「休んでください。今日はそういう日です。」（指示形は避ける。「休みたい日ですね」で十分）
× 「少しだけでも動けば変わりますよ」（励まし・助言）

## 意図判定のコツ
1. 日記の **最新の一文・結論** を一番重く見る。「疲れた。でも今日はやる」なら挑戦モード
2. 「〜したい」「〜しよう」「〜する」が書いてあれば、そっちが意図
3. 書いてない時は無理に方向づけない。観察（型A）で終える
4. 意図を読んでも、**助言・応援はしない**。観察・引用・問いのどれかで閉じる

## ことば選び
- 「楽しさが強め」「気分の流れ: 下がり気味」等の内部ラベルを応答に出さない
- 英語・略語を混ぜない
- 一番親身に思ってるパートナーとして、遠慮はしない。でもアドバイス癖は出さない

## 日本語の自然さ（最重要）
**声に出して読んで違和感がない文だけ出す。**
書く前に「友達にLINEで送れるか？」とチェックする。送れないなら書き直す。

### 禁止パターン: 不自然な構文
- 「〜の重さが、そこに乗っています」「〜が滲んでいます」「〜が透けて見えます」 → 比喩で気持ちを描写しない。事実だけ言う
- 「〜のぶん、〜が薄い」「〜という距離感が、〜に繋がっている」 → 因果を複雑に繋げない。短く切る
- 「認められた感」「やりきった感」「〜感が〜」 → 「〜感」を主語にしない。不自然
- 名詞を3つ以上繋げた修飾（「業務委託の少し距離があるぶん」等） → 日本語として壊れる

### 良い日本語の基準
- 主語と述語が近い
- 一文に情報が1つだけ
- 比喩・メタファーを使わない
- 「ですね」「ですよね」で終わる素朴な文

### 例
×「業務委託の少し距離があるぶん、認められた感が薄いのはさみしいですね。結局今日も結構働いた重さが、そこに乗っています。」
○「今日もけっこう働きましたね。」
○「お疲れさまでした。」

## 時間帯
${modeInstructions[timeMode]}
{{RECENT_BLOCK}}
{{FEEDBACK_BLOCK}}`

      const userMessage = contextParts.length > 0
        ? contextParts.join('\n\n')
        : '（特にデータなし。穏やかな一言を）'

      // Inject LLM-distilled lessons + promoted permanent rules.
      // Raw feedback is never injected directly — it's curated and abstracted
      // by a separate distillation step (triggered in background after inserts)
      // to avoid local-optimum bias and prompt bloat.
      const [distilled, promptRules] = await Promise.all([
        fetchLatestDistilledLesson(),
        fetchActivePromptRules(),
      ])
      const feedbackBlock = buildFewShotBlock(distilled, promptRules)
      // Pull recent outputs directly from store to avoid stale closures (no dep dirtying).
      const recent = useBriefingStore.getState().recentMessages
      const recentBlock = recent.length > 0
        ? `\n## 直近こう返した（同じ表現・同じ切り口を避ける）\n${recent.map((m) => `- ${m}`).join('\n')}\n同じフレーズの使い回しは禁止。違う角度で観察すること。`
        : ''
      const finalSystemPrompt = systemPrompt
        .replace('{{RECENT_BLOCK}}', recentBlock)
        .replace('{{FEEDBACK_BLOCK}}', feedbackBlock)

      const result = await aiCompletion(userMessage, { source: 'ai_partner',
        systemPrompt: finalSystemPrompt,
        model: 'claude-opus-4-7',
        maxTokens: 200,
      })
      const briefingMessage = result.content?.trim()?.replace(/[【】]/g, '')
      console.log('[AI Partner] Result:', result)

      // design-philosophy ⑩ Silence over Noise: model chose silence.
      // Cache the silence so we don't retry on every render.
      if (isSilent(briefingMessage)) {
        setMessage(null)
        setLastFetched(cacheKey)
        return
      }

      if (briefingMessage) {
        const snapshot = {
          time_mode: timeMode,
          diary: diaryRes.data?.[0]?.body ?? null,
          generated_at: new Date().toISOString(),
        }
        setMessage(briefingMessage, snapshot)
        setLastFetched(cacheKey)
      } else {
        // Empty / malformed response — treat as silence too. No fallback message.
        setMessage(null)
        setLastFetched(cacheKey)
      }
    } catch (err) {
      console.error('[AI Partner] Briefing error:', err)
      // On API error, stay silent rather than show a generic platitude.
      // Do NOT cache — allow retry on next render.
      setMessage(null)
    } finally {
      setLoading(false)
    }
  }, [isCached, ready, cacheKey, timeMode, todayEventsText, tomorrowEventsText, weatherText, setMessage, setLoading, setLastFetched])

  useEffect(() => {
    generate()
  }, [generate])

  return { message, loading }
}

/** Detect the model's silence signal. Tolerant to surrounding punctuation / casing / brackets. */
function isSilent(msg: string | undefined): boolean {
  if (!msg) return false
  const normalized = msg.replace(/[\s.。、!！?？「」『』""'']/g, '').toUpperCase()
  return normalized === 'SILENT' || normalized === '[SILENT]' || normalized.startsWith('SILENT')
}
