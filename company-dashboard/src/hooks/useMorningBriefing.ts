import { useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { aiCompletion } from '@/lib/edgeAi'
import { calculateStreak } from '@/lib/streak'
import { useBriefingStore } from '@/stores/briefing'
import type { TimeMode } from '@/lib/timeMode'

/** Plutchik keys */
const PLUTCHIK_KEYS = ['joy', 'trust', 'fear', 'surprise', 'sadness', 'disgust', 'anger', 'anticipation'] as const

/**
 * Deep-personalized AI comment for Today screen.
 * Injects diary emotions, WBI trends, CEO insights, work rhythm,
 * calendar context, tasks, dreams, and streak data into the prompt.
 */
export function useMorningBriefing(
  timeMode: TimeMode,
  todayEventsText?: string,
  tomorrowEventsText?: string,
) {
  const { message, loading, lastFetched, setMessage, setLoading, setLastFetched } = useBriefingStore()

  const cacheKey = `${new Date().toISOString().substring(0, 10)}_${timeMode}`
  const isCached = lastFetched === cacheKey && message !== null

  const generate = useCallback(async () => {
    if (isCached) return
    setLoading(true)

    try {
      // Collect all context data in parallel
      const [diaryRes, emotionRes, tasksRes, dreamsRes, insightsRes, rhythmRes, streakResult] = await Promise.all([
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

      // Build emotion context
      let emotionContext = ''
      if (emotionRes.data && emotionRes.data.length > 0) {
        const avg: Record<string, number> = {}
        let totalWbi = 0
        const count = emotionRes.data.length
        for (const e of emotionRes.data) {
          for (const key of PLUTCHIK_KEYS) {
            avg[key] = (avg[key] ?? 0) + ((e as Record<string, number>)[key] ?? 0)
          }
          totalWbi += (e as Record<string, number>).wbi_score ?? 0
        }
        let dominant = 'joy'
        let maxVal = 0
        for (const key of PLUTCHIK_KEYS) {
          avg[key] = avg[key] / count
          if (avg[key] > maxVal) { maxVal = avg[key]; dominant = key }
        }
        const avgWbi = totalWbi / count
        emotionContext = `直近の感情傾向(${count}件): 主要感情=${dominant}(${Math.round(maxVal)}), WBI平均=${avgWbi.toFixed(1)}`
      }

      // WBI trend (last 7 days)
      let wbiTrend = ''
      if (diaryRes.data && diaryRes.data.length >= 2) {
        const wbis = diaryRes.data.filter((d) => d.wbi != null).map((d) => d.wbi as number)
        if (wbis.length >= 2) {
          const recent = wbis[0]
          const prev = wbis.slice(1).reduce((a, b) => a + b, 0) / (wbis.length - 1)
          const diff = recent - prev
          wbiTrend = `WBI推移: 最新${recent.toFixed(1)} / 過去平均${prev.toFixed(1)} (${diff > 0 ? '+' : ''}${diff.toFixed(1)})`
        }
      }

      // Recent diary
      const recentDiary = diaryRes.data
        ?.slice(0, 3)
        .map((e) => `[${e.created_at.substring(0, 10)}] ${(e.body ?? '').substring(0, 100)}`)
        .join('\n') || ''

      // Work rhythm analysis
      let workRhythm = ''
      if (rhythmRes.data && rhythmRes.data.length > 0) {
        const lateNight = rhythmRes.data.filter((p) => {
          const h = new Date(p.created_at).getHours()
          return h >= 22 || h < 6
        }).length
        const ratio = Math.round((lateNight / rhythmRes.data.length) * 100)
        if (ratio > 20) {
          workRhythm = `深夜作業率: ${ratio}%（直近${rhythmRes.data.length}件中${lateNight}件が22時-6時）`
        }
      }

      // CEO insights
      const insightsText = insightsRes.data
        ?.map((i) => `[${(i as { category: string }).category}] ${(i as { insight: string }).insight}`)
        .join('\n') || ''

      // Tasks
      const todayStr = new Date().toISOString().substring(0, 10)
      const openTasks = (tasksRes.data || []).filter((t) => t.status === 'open')
      const completedToday = (tasksRes.data || []).filter(
        (t) => t.status === 'done' && t.completed_at?.substring(0, 10) === todayStr,
      )
      const dueTodayTasks = openTasks.filter((t) => t.due_date === todayStr)

      // Dreams
      const dreamsText = dreamsRes.data
        ?.map((d) => `${d.title} (${d.status})`)
        .join(', ') || ''

      // Build the context block
      const now = new Date()
      const currentTime = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`
      const contextParts: string[] = [`現在時刻: ${currentTime}`]
      if (emotionContext) contextParts.push(emotionContext)
      if (wbiTrend) contextParts.push(wbiTrend)
      if (recentDiary) contextParts.push(`直近の日記:\n${recentDiary}`)
      if (todayEventsText) contextParts.push(`今日の予定:\n${todayEventsText}`)
      if (tomorrowEventsText) contextParts.push(`明日の予定:\n${tomorrowEventsText}`)
      if (completedToday.length > 0) {
        contextParts.push(`今日完了したタスク: ${completedToday.map((t) => t.title).join('、')}`)
      }
      if (dueTodayTasks.length > 0) {
        contextParts.push(`期限が今日のタスク: ${dueTodayTasks.map((t) => t.title).join('、')}`)
      }
      if (openTasks.length > 0) {
        contextParts.push(`未完了タスク(${openTasks.length}件): ${openTasks.slice(0, 3).map((t) => t.title).join('、')}`)
      }
      if (workRhythm) contextParts.push(workRhythm)
      if (insightsText) contextParts.push(`社長の特徴:\n${insightsText}`)
      if (dreamsText) contextParts.push(`進行中の夢: ${dreamsText}`)
      if (streakResult > 0) contextParts.push(`連続記録: ${streakResult}日`)

      // Time-mode specific instructions
      const modeInstructions: Record<TimeMode, string> = {
        morning: `朝。今日の心構えを1-2文、80字以内で。
例: 「今日はMTGが3件。午前中に集中作業の時間を確保するといいかもしれません」`,
        afternoon: `昼。午前への承認を1文、50字以内で。
例: 「午前中に1件完了できましたね。午後もこのペースで」`,
        evening: `夜。今日への共感と労いを2文、100字以内で。明日の予定にも軽く触れる。
例: 「夜遅くまで続いていますね。今日はMTG3件こなして充分です。明日午前フリーなので少しゆっくりでも」`,
      }

      const systemPrompt = `あなたはユーザーの人生パートナーAI。一番の理解者。

## 最重要: 短く。最大2-3文、100字以内。長い文章は絶対NG。

## 口調
- 丁寧だが堅すぎない（です・ます調）
- 温かく、感情に寄り添う

## 絶対にやらないこと
- 長文（3文以上）
- 実行できない約束
- 業務報告の羅列
- 汎用的な言葉（「頑張りましょう」「無理せず」）

## 最重要ルール
この人固有の文脈に1つだけ触れる。全部に触れない。一番響くことを1つ選ぶ。

## 時間帯指示
${modeInstructions[timeMode]}

テキストのみ返してください。`

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
  }, [isCached, cacheKey, timeMode, todayEventsText, tomorrowEventsText, setMessage, setLoading, setLastFetched])

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
