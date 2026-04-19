import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { aiCompletion } from '@/lib/edgeAi'
import { archiveStoryMemoryById } from '@/lib/storyMemoryArchive'
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

      // design-philosophy ⑩ Silence over Noise: feed the previous interpretation
      // so the model can decide "nothing meaningfully changed; stay silent".
      const { data: previousArcRow } = await supabase
        .from('story_memory')
        .select('narrative_text, updated_at')
        .eq('memory_type', 'current_arc')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      const previousBlock = previousArcRow?.narrative_text
        ? `\n\n## 前回の解釈 (${previousArcRow.updated_at?.substring(0, 10) ?? ''})\n"${previousArcRow.narrative_text}"`
        : ''

      const result = await aiCompletion(
        `## 感情の時系列データ（${emotions.length}件）\n${JSON.stringify(emotionTimeline, null, 1)}\n\n## 日記の抜粋\n${diarySnippets}${previousBlock}`,
        {
          systemPrompt: `感情データと日記の内容から、この人の最近2週間の状態を具体的に読み取る。

## 沈黙の選択（design-philosophy ⑩）
「前回の解釈」が提示されている場合、前回と実質同じ状態（同じフェーズ・同じ文脈で前回の narrative でも通用する）なら、再解釈せず SILENT を返す。
同じことを言い換えただけの再生成は、ユーザーから見ると AI の過剰介入。本当に変化があった時だけ新しい narrative を書く。

SILENT 時の出力: {"phase": null, "narrative": "SILENT", "confidence": 0}

## フェーズ（内部分類用）
- exploration: 新しいことを試している。不安と期待が混在
- immersion: 何かに集中して取り組んでいる
- reflection: 立ち止まって考えている。ペースが落ちている
- reconstruction: 方向性を見直している。感情の振れ幅が大きい
- leap: 手応えを感じている。前に進む力が強い

## narrative の書き方
事実ベースで書く。日記の内容に触れながら、何がどう変わったかを具体的に。

### 良い例
- "ここ2週間、手を動かす話が増えていて、迷いや不安の記述が減っています。特に後半は達成感に関する記述が目立ちます。"
- "先週前半は疲れや停滞感が日記に出ていましたが、後半から切り替わっています。人と話した日を境に変わった可能性があります。"

### 悪い例
- "飛躍のフェーズに入っています"（抽象ラベル。何が飛躍してるか不明）
- "大きな扉を開けた気がする"（詩的すぎて中身がない）
- "自信が戻ってきて、進むべき道がキラリと見えてきた"（スピリチュアル）

## 出力（JSON）
{
  "phase": "exploration" | "immersion" | "reflection" | "reconstruction" | "leap",
  "narrative": "事実ベースの状態描写。1-2文。です・ます調。",
  "confidence": 0.0-1.0
}`,
          jsonMode: true,
          temperature: 0.5,
          maxTokens: 300,
          source: 'arc_reader',
        },
      )

      const parsed = JSON.parse(result.content) as ArcReaderResult

      // design-philosophy ⑩ Silence over Noise: model signalled no meaningful
      // change. Keep the existing interpretation visible, skip the DB write.
      if (!parsed.phase || parsed.narrative === 'SILENT') {
        if (previousArcRow?.narrative_text) {
          // Surface the previous interpretation so the UI still has something to render.
          setArc({
            phase: (parsed.phase as ArcReaderResult['phase']) ?? 'reflection',
            narrative: previousArcRow.narrative_text,
            confidence: 1,
          })
        }
        return null
      }

      setArc(parsed)

      // Persist to story_memory (append-only via archive-then-update)
      const { data: existing } = await supabase
        .from('story_memory')
        .select('id, version')
        .eq('memory_type', 'current_arc')
        .limit(1)
        .single()

      if (existing) {
        // design-philosophy ③ Append-only: snapshot the previous state first.
        await archiveStoryMemoryById(existing.id, 'arc_reader_refresh')
        const prevVersion = (existing as { version?: number }).version ?? 1
        await supabase
          .from('story_memory')
          .update({
            content: parsed,
            narrative_text: parsed.narrative,
            version: prevVersion + 1,
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
