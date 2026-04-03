import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface DreamDetection {
  dream_id: number
  dream_title: string
  confidence: 'high' | 'medium' | 'low'
  reason: string
}

interface UseDreamDetectionReturn {
  detect: (diaryContent: string) => Promise<DreamDetection[]>
  detecting: boolean
}

// NOTE: API key is sent from client for simplicity in personal use.
// For production/multi-user, move to Supabase Edge Function.

/**
 * Hook to detect dream progress from diary entries.
 * Compares diary content against active/in_progress dreams using AI.
 * Returns detections with medium+ confidence only. Does NOT auto-update dream status.
 */
export function useDreamDetection(): UseDreamDetectionReturn {
  const [detecting, setDetecting] = useState(false)

  const detect = useCallback(async (diaryContent: string): Promise<DreamDetection[]> => {
    if (!diaryContent.trim()) return []
    setDetecting(true)

    try {
      // Get dreams
      const { data: dreams } = await supabase
        .from('dreams')
        .select('id, title, description')
        .in('status', ['active', 'in_progress'])

      if (!dreams || dreams.length === 0) {
        setDetecting(false)
        return []
      }

      // Get API key
      const { data: settings } = await supabase
        .from('user_settings')
        .select('openai_api_key')
        .single()

      if (!settings?.openai_api_key) {
        setDetecting(false)
        return []
      }

      const dreamList = dreams
        .map((d: { id: number; title: string; description: string | null }) =>
          `- ID:${d.id} "${d.title}"${d.description ? ` (${d.description})` : ''}`)
        .join('\n')

      const systemPrompt = `ユーザーの日記と夢リストを照合し、達成に近づいた夢をJSONで返してください:
{ "detections": [{ "dream_id": number, "confidence": "high"|"medium"|"low", "reason": "理由" }] }
該当なしは空配列。過剰検出は避ける（confidenceがmedium以上のみ返す）。
JSON以外は返さないでください。`

      const userMessage = `## 日記\n${diaryContent}\n\n## 夢リスト\n${dreamList}`

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
          response_format: { type: 'json_object' },
          temperature: 0.3,
          max_tokens: 500,
        }),
      })

      if (!response.ok) {
        setDetecting(false)
        return []
      }

      const data = await response.json()
      const resultText = data.choices?.[0]?.message?.content
      if (!resultText) {
        setDetecting(false)
        return []
      }

      const parsed = JSON.parse(resultText)
      const detections: DreamDetection[] = (parsed.detections ?? [])
        .filter((d: { confidence: string }) => d.confidence === 'high' || d.confidence === 'medium')
        .map((d: { dream_id: number; confidence: 'high' | 'medium'; reason: string }) => {
          const dream = dreams.find((dr: { id: number }) => dr.id === d.dream_id)
          return {
            ...d,
            dream_title: dream?.title ?? `Dream #${d.dream_id}`,
          }
        })

      setDetecting(false)
      return detections
    } catch {
      setDetecting(false)
      return []
    }
  }, [])

  return { detect, detecting }
}
