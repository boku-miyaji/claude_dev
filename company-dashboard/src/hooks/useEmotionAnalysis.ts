import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'

const EMOTION_ANALYSIS_PROMPT = `あなたは感情分析の専門家です。日記のテキストを分析し、以下のJSON形式で返してください:
{
  "plutchik": { "joy": 0, "trust": 0, "fear": 0, "surprise": 0, "sadness": 0, "disgust": 0, "anger": 0, "anticipation": 0 },
  "russell": { "valence": 0.0, "arousal": 0.0 },
  "perma_v": { "p": 0, "e": 0, "r": 0, "m": 0, "a": 0, "v": 0 },
  "wbi": 0,
  "summary": "感情の要約（1文）"
}
Plutchikの各値は0-100の整数。混合感情も検出してください。強い感情は80以上、弱い感情は20以下。
russellのvalenceは-1.0〜1.0（ネガティブ〜ポジティブ）、arousalは-1.0〜1.0（低覚醒〜高覚醒）。
PERMA+Vは0-10の実数: P=ポジティブ感情, E=没頭, R=人間関係, M=意味, A=達成, V=活力。
WBIはPERMA+Vの加重平均（0-10）。
JSON以外は返さないでください。`

interface EmotionResult {
  plutchik: Record<string, number>
  russell: { valence: number; arousal: number }
  perma_v: Record<string, number>
  wbi: number
  summary: string
}

interface UseEmotionAnalysisReturn {
  analyze: (diaryEntryId: string, content: string) => Promise<EmotionResult | null>
  analyzing: boolean
  error: string | null
}

/**
 * Hook to trigger AI emotion analysis for a diary entry.
 * Calls OpenAI API with the user's API key from user_settings,
 * then stores results in emotion_analysis table and updates diary_entries.wbi.
 */
export function useEmotionAnalysis(): UseEmotionAnalysisReturn {
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const analyze = useCallback(async (diaryEntryId: string, content: string): Promise<EmotionResult | null> => {
    if (!content.trim()) return null
    setAnalyzing(true)
    setError(null)

    try {
      // Get API key from user_settings
      const { data: settings, error: settingsErr } = await supabase
        .from('user_settings')
        .select('openai_api_key')
        .single()

      if (settingsErr || !settings?.openai_api_key) {
        setError('OpenAI API keyが設定されていません。Settings画面で設定してください。')
        setAnalyzing(false)
        return null
      }

      // Call OpenAI API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.openai_api_key}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: EMOTION_ANALYSIS_PROMPT },
            { role: 'user', content },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
        }),
      })

      if (!response.ok) {
        const errBody = await response.text()
        throw new Error(`OpenAI API error: ${response.status} ${errBody.substring(0, 200)}`)
      }

      const data = await response.json()
      const resultText = data.choices?.[0]?.message?.content
      if (!resultText) throw new Error('Empty response from OpenAI')

      const result: EmotionResult = JSON.parse(resultText)

      // Insert into emotion_analysis
      await supabase.from('emotion_analysis').insert({
        diary_entry_id: diaryEntryId,
        joy: result.plutchik.joy ?? 0,
        trust: result.plutchik.trust ?? 0,
        fear: result.plutchik.fear ?? 0,
        surprise: result.plutchik.surprise ?? 0,
        sadness: result.plutchik.sadness ?? 0,
        disgust: result.plutchik.disgust ?? 0,
        anger: result.plutchik.anger ?? 0,
        anticipation: result.plutchik.anticipation ?? 0,
        valence: result.russell.valence ?? 0,
        arousal: result.russell.arousal ?? 0,
        perma_p: result.perma_v.p ?? 0,
        perma_e: result.perma_v.e ?? 0,
        perma_r: result.perma_v.r ?? 0,
        perma_m: result.perma_v.m ?? 0,
        perma_a: result.perma_v.a ?? 0,
        perma_v: result.perma_v.v ?? 0,
        wbi_score: result.wbi ?? 0,
        model_used: 'gpt-4o-mini',
      })

      // Update diary_entries.wbi
      await supabase
        .from('diary_entries')
        .update({ wbi: result.wbi })
        .eq('id', diaryEntryId)

      setAnalyzing(false)
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      setAnalyzing(false)
      return null
    }
  }, [])

  return { analyze, analyzing, error }
}
