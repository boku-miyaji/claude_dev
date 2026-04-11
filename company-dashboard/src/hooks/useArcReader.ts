import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { aiCompletion } from '@/lib/edgeAi'
import type { ArcReaderResult } from '@/types/narrator'

/**
 * Arc Reader — 感情の推移を物語構造として解釈するエンジン。
 *
 * 過去14日分の emotion_analysis を取得し、LLM が現在のフェーズを判定。
 * 結果は story_memory (memory_type='current_arc') に保存。
 * 週次で更新（最終更新から7日以上経過した場合のみ再生成）。
 */
export function useArcReader() {
  const [arc, setArc] = useState<ArcReaderResult | null>(null)
  const [loading, setLoading] = useState(false)

  const analyze = useCallback(async (forceRefresh = false): Promise<ArcReaderResult | null> => {
    // Check cached arc from story_memory
    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from('story_memory')
        .select('content, updated_at')
        .eq('memory_type', 'current_arc')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      if (cached) {
        const daysSinceUpdate = (Date.now() - new Date(cached.updated_at).getTime()) / 86400000
        if (daysSinceUpdate < 7) {
          const result = cached.content as unknown as ArcReaderResult
          setArc(result)
          return result
        }
      }
    }

    setLoading(true)
    try {
      // Fetch recent emotion data (14 days)
      const fourteenDaysAgo = new Date()
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

      const { data: emotions } = await supabase
        .from('emotion_analysis')
        .select('joy, trust, fear, surprise, sadness, disgust, anger, anticipation, valence, arousal, wbi_score, created_at')
        .gte('created_at', fourteenDaysAgo.toISOString())
        .order('created_at', { ascending: true })

      if (!emotions || emotions.length < 3) {
        setLoading(false)
        return null // Not enough data
      }

      // Fetch recent diary entries for narrative context
      const { data: diaries } = await supabase
        .from('diary_entries')
        .select('body, created_at')
        .gte('created_at', fourteenDaysAgo.toISOString())
        .order('created_at', { ascending: true })
        .limit(10)

      // Build temporal emotion profile
      const emotionTimeline = emotions.map((e) => ({
        date: e.created_at.substring(0, 10),
        dominant: getDominant(e),
        wbi: e.wbi_score,
        valence: e.valence,
        arousal: e.arousal,
      }))

      const diarySnippets = (diaries || [])
        .map((d) => `[${d.created_at.substring(0, 10)}] ${d.body.substring(0, 120)}`)
        .join('\n')

      const result = await aiCompletion(
        `## 感情の時系列データ（${emotions.length}件）\n${JSON.stringify(emotionTimeline, null, 1)}\n\n## 日記の抜粋\n${diarySnippets}`,
        {
          systemPrompt: `あなたは人生の物語を読み解く存在。感情データの時系列推移から、この人が今どんな「章」にいるかを解釈する。

## フェーズの定義
- exploration: 新しいことを探っている時期。好奇心・不安が混在
- immersion: 何かに没頭している時期。高いengagement、arousal高め
- reflection: 立ち止まって内省している時期。valence低めだが安定
- reconstruction: 価値観や方向性を再構築している時期。感情の揺れが大きい
- leap: 突破・飛躍の時期。joy/anticipation高め、自信の回復

## ルール
- if文やスコア閾値で判定しない。物語全体の流れから解釈する
- 1つのフェーズに無理に当てはめない。複合的でもよい
- 日記テキストがある場合は内容も踏まえる
- 過去の類似パターンとの接続は今回は不要

## 出力（JSON）
{
  "phase": "exploration" | "immersion" | "reflection" | "reconstruction" | "leap",
  "narrative": "今の状態を1-2文で。友達がボソッと言う感じで。",
  "confidence": 0.0-1.0
}`,
          jsonMode: true,
          temperature: 0.5,
          maxTokens: 300,
          source: 'arc_reader',
        },
      )

      const parsed = JSON.parse(result.content) as ArcReaderResult
      setArc(parsed)

      // Persist to story_memory
      const { data: existing } = await supabase
        .from('story_memory')
        .select('id')
        .eq('memory_type', 'current_arc')
        .limit(1)
        .single()

      if (existing) {
        await supabase
          .from('story_memory')
          .update({
            content: parsed,
            narrative_text: parsed.narrative,
            version: (existing as { id: number }).id ? 2 : 1, // increment conceptually
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
      } else {
        await supabase
          .from('story_memory')
          .insert({
            memory_type: 'current_arc',
            content: parsed,
            narrative_text: parsed.narrative,
          })
      }

      return parsed
    } catch (err) {
      console.error('[Arc Reader] Error:', err)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-load on mount
  useEffect(() => {
    analyze()
  }, [analyze])

  return { arc, loading, refresh: () => analyze(true) }
}

/** Get dominant emotion from an analysis record */
function getDominant(e: Record<string, unknown>): string {
  const emotions = ['joy', 'trust', 'fear', 'surprise', 'sadness', 'disgust', 'anger', 'anticipation'] as const
  let max = 0
  let dominant = 'joy'
  for (const key of emotions) {
    const val = (e[key] as number) ?? 0
    if (val > max) { max = val; dominant = key }
  }
  return dominant
}
