import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { aiCompletion } from '@/lib/edgeAi'

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

      const dreamList = dreams
        .map((d: { id: number; title: string; description: string | null }) =>
          `- ID:${d.id} "${d.title}"${d.description ? ` (${d.description})` : ''}`)
        .join('\n')

      const systemPrompt = `ユーザーの日記と夢リストを照合し、達成に近づいた夢をJSONで返してください:
{ "detections": [{ "dream_id": number, "confidence": "high"|"medium"|"low", "reason": "理由" }] }
該当なしは空配列。過剰検出は避ける（confidenceがmedium以上のみ返す）。
JSON以外は返さないでください。`

      const userMessage = `## 日記\n${diaryContent}\n\n## 夢リスト\n${dreamList}`

      const { content: resultText } = await aiCompletion(userMessage, {
        systemPrompt,
        jsonMode: true,
        temperature: 0.3,
        maxTokens: 500,
      })

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
