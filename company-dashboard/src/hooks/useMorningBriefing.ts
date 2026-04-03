import { useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { calculateStreak } from '@/lib/streak'
import { useBriefingStore } from '@/stores/briefing'
import { buildPartnerSystemPrompt, getTimeOfDay } from '@/lib/aiPartner'
import type { PartnerContext, EmotionSummary } from '@/lib/aiPartner'

/** Plutchik keys for finding dominant emotion */
const PLUTCHIK_KEYS = ['joy', 'trust', 'fear', 'surprise', 'sadness', 'disgust', 'anger', 'anticipation'] as const

// NOTE: API key is sent from client for simplicity in personal use.
// For production/multi-user, move to Supabase Edge Function.

/**
 * Hook to generate a morning briefing message from the AI Partner.
 * - Collects recent diary, emotions, tasks, dreams
 * - Calls OpenAI API once per day
 * - Caches in Zustand store
 * - Falls back to static templates if no API key
 */
export function useMorningBriefing() {
  const { message, loading, lastFetched, setMessage, setLoading, setLastFetched } = useBriefingStore()

  const today = new Date().toISOString().substring(0, 10)
  const isCached = lastFetched === today && message !== null

  const generate = useCallback(async () => {
    if (isCached) return
    setLoading(true)

    try {
      // Collect context data in parallel
      const [diaryRes, emotionRes, tasksRes, dreamsRes, streakResult] = await Promise.all([
        supabase
          .from('diary_entries')
          .select('body, created_at')
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('emotion_analysis')
          .select('joy, trust, fear, surprise, sadness, disgust, anger, anticipation, valence, arousal, wbi_score')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('tasks')
          .select('title, due_date')
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('dreams')
          .select('title, status')
          .in('status', ['active', 'in_progress'])
          .limit(5),
        calculateStreak(),
      ])

      const streak = streakResult

      // Build emotion summary
      let recentEmotions: EmotionSummary | undefined
      if (emotionRes.data && emotionRes.data.length > 0) {
        const avg: Record<string, number> = {}
        let totalValence = 0
        let totalArousal = 0
        let totalWbi = 0
        const count = emotionRes.data.length
        for (const e of emotionRes.data) {
          for (const key of PLUTCHIK_KEYS) {
            avg[key] = (avg[key] ?? 0) + ((e as Record<string, number>)[key] ?? 0)
          }
          totalValence += (e as Record<string, number>).valence ?? 0
          totalArousal += (e as Record<string, number>).arousal ?? 0
          totalWbi += (e as Record<string, number>).wbi_score ?? 0
        }
        let dominantEmotion = 'joy'
        let maxVal = 0
        for (const key of PLUTCHIK_KEYS) {
          avg[key] = avg[key] / count
          if (avg[key] > maxVal) {
            maxVal = avg[key]
            dominantEmotion = key
          }
        }
        recentEmotions = {
          dominantEmotion,
          valence: totalValence / count,
          arousal: totalArousal / count,
          wbi: totalWbi / count,
        }
      }

      // Build recent diary text
      const recentDiary = diaryRes.data
        ?.map((e: { body: string; created_at: string }) =>
          `[${e.created_at.substring(0, 10)}] ${e.body.substring(0, 150)}`,
        )
        .join('\n')

      const context: PartnerContext = {
        recentDiary,
        recentEmotions,
        dreams: dreamsRes.data as { title: string; status: string }[] | undefined,
        openTasks: tasksRes.data as { title: string; due_date?: string }[] | undefined,
        streak,
        timeOfDay: getTimeOfDay(),
      }

      // Get API key
      const { data: settings } = await supabase
        .from('user_settings')
        .select('openai_api_key')
        .single()

      if (!settings?.openai_api_key) {
        // Fallback to static message
        const fallbacks = [
          '今日も一日、あなたのペースで大丈夫ですよ。',
          '小さな一歩の積み重ねが、大きな変化を生みます。',
          '今この瞬間を大切に過ごしてくださいね。',
        ]
        const idx = new Date().getDate() % fallbacks.length
        setMessage(fallbacks[idx])
        setLastFetched(today)
        setLoading(false)
        return
      }

      // Call OpenAI API
      const systemPrompt = buildPartnerSystemPrompt(context)
      const userMessage = '今日のブリーフィングを2-3文で簡潔に伝えてください。ユーザーの状況を踏まえ、温かく穏やかなトーンでお願いします。長すぎず、心に残る内容を。'

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.openai_api_key}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          max_tokens: 200,
          temperature: 0.8,
        }),
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`)
      }

      const data = await response.json()
      const briefingMessage = data.choices?.[0]?.message?.content?.trim()

      if (briefingMessage) {
        setMessage(briefingMessage)
        setLastFetched(today)
      } else {
        setMessage('今日も穏やかに過ごせますように。')
        setLastFetched(today)
      }
    } catch (_err) {
      // On error, use a fallback
      setMessage('今日も一日、あなたのペースで進んでいきましょう。')
      setLastFetched(today)
    } finally {
      setLoading(false)
    }
  }, [isCached, today, setMessage, setLoading, setLastFetched])

  useEffect(() => {
    generate()
  }, [generate])

  return { message, loading }
}
