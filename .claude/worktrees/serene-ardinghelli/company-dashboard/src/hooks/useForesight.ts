import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { aiCompletion } from '@/lib/edgeAi'

interface ForesightResult {
  insight: string    // 1-2 sentence foresight
  basis: string      // what data it's based on
}

/**
 * Foresight Engine — 過去パターンから次の展開を予感する。
 *
 * Arc Reader + Theme Finder + 過去の類似感情パターンを元に、
 * 「次に起こりそうなこと」を物語ベースで提案。
 * Today ブリーフィングの下に表示。週次更新。
 */
export function useForesight() {
  const [foresight, setForesight] = useState<ForesightResult | null>(null)
  const [loading, setLoading] = useState(false)

  const generate = useCallback(async (forceRefresh = false): Promise<ForesightResult | null> => {
    // Check cache (localStorage, 7 day TTL)
    const cacheKey = 'foresight_cache'
    if (!forceRefresh) {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        try {
          const { result, ts } = JSON.parse(cached)
          if (Date.now() - ts < 7 * 86400000) {
            setForesight(result)
            return result
          }
        } catch { /* cache invalid */ }
      }
    }

    setLoading(true)
    try {
      // Gather context: current arc + theme + recent emotions
      const [arcRes, themeRes, emotionRes] = await Promise.all([
        supabase.from('story_memory').select('content, narrative_text').eq('memory_type', 'current_arc').limit(1).single(),
        supabase.from('story_memory').select('content, narrative_text').eq('memory_type', 'identity').limit(1).single(),
        supabase.from('emotion_analysis')
          .select('joy, trust, fear, surprise, sadness, anger, anticipation, wbi_score, created_at')
          .order('created_at', { ascending: false })
          .limit(14),
      ])

      const arcText = arcRes.data?.narrative_text || ''
      const themeText = themeRes.data?.narrative_text || ''
      const emotions = emotionRes.data || []

      if (!arcText && !themeText && emotions.length < 5) {
        setLoading(false)
        return null // Not enough data
      }

      // Build emotion trajectory summary
      const emotionSummary = emotions.length > 0
        ? emotions.slice(0, 7).map((e) => `${e.created_at.substring(5, 10)}: WBI=${e.wbi_score}, joy=${e.joy}, fear=${e.fear}, anticipation=${e.anticipation}`).join('\n')
        : 'データ不足'

      const result = await aiCompletion(
        `## 今のフェーズ\n${arcText || '不明'}\n\n## テーマ\n${themeText || '不明'}\n\n## 最近の感情推移\n${emotionSummary}`,
        {
          systemPrompt: `あなたは「次に起こりそうなこと」を予感する存在。過去のパターンと今のフェーズから、この人の近い未来を読む。

## ルール
- 「〜しましょう」「〜するといい」は禁止。提案ではなく予感。
- 「こういう流れだと、次は〜になりがち」のような語り口
- 具体的な行動指示は出さない
- 1-2文で短く
- 友達がボソッと言う感じ

## 出力（JSON）
{"insight": "予感の一言", "basis": "根拠を一文で"}`,
          jsonMode: true,
          temperature: 0.7,
          maxTokens: 200,
          source: 'foresight',
        },
      )

      const parsed = JSON.parse(result.content) as ForesightResult
      setForesight(parsed)
      localStorage.setItem(cacheKey, JSON.stringify({ result: parsed, ts: Date.now() }))
      return parsed
    } catch {
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    generate()
  }, [generate])

  return { foresight, loading, refresh: () => generate(true) }
}
