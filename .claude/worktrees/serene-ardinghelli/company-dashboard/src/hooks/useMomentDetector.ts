import { useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { aiCompletion } from '@/lib/edgeAi'

/**
 * Moment Detector — 日記投稿後に自動実行。転機（重要な瞬間）を検出する。
 *
 * 検出タイプ: decision / realization / breakthrough / connection / setback
 * 検出時はユーザーに確認を求める（user_confirmed = false で保存）。
 */
export function useMomentDetector() {
  const detect = useCallback(async (diaryEntryId: number, content: string): Promise<{
    detected: boolean
    moment?: { type: string; title: string; description: string }
  }> => {
    if (content.length < 30) return { detected: false } // Too short to be meaningful

    try {
      const result = await aiCompletion(content, {
        systemPrompt: `あなたは人生の転機を検出するセンサー。日記テキストを読み、この人にとって重要な瞬間（転機）かどうかを判定する。

## 転機の定義
- decision: 大きな意思決定をした（転職、プロジェクト開始/終了、方針変更等）
- realization: 何かに気づいた（価値観の変化、自分の傾向の発見等）
- breakthrough: 壁を突破した（長期課題の解決、スキルの飛躍等）
- connection: 人との出会いや関係の深まり
- setback: 挫折や困難（ただしそこから学びがあるもの）

## 判定基準
- 日常の報告は転機ではない（「今日は会議があった」→ NO）
- 感情の強い動きがある（「初めて〜した」「やっと〜できた」「考え方が変わった」）→ YES の可能性
- 過去の自分との比較がある → YES の可能性
- 大半の日記は転機ではない。厳しめに判定する（10件に1件程度）

## 出力（JSON）
転機でない場合: {"detected": false}
転機の場合: {"detected": true, "type": "realization", "title": "3語以内のタイトル", "description": "何が起きて何が変わったか。1-2文。"}`,
        jsonMode: true,
        temperature: 0.3,
        maxTokens: 200,
        source: 'moment_detector',
      })

      const parsed = JSON.parse(result.content)
      if (!parsed.detected) return { detected: false }

      // Save to story_moments (unconfirmed)
      // Fetch recent emotion for snapshot
      const { data: recentEmotion } = await supabase
        .from('emotion_analysis')
        .select('joy, trust, fear, surprise, sadness, disgust, anger, anticipation, valence, wbi_score')
        .eq('diary_entry_id', diaryEntryId)
        .limit(1)
        .single()

      await supabase.from('story_moments').insert({
        moment_type: parsed.type,
        title: parsed.title,
        description: parsed.description,
        diary_entry_id: diaryEntryId,
        emotion_snapshot: recentEmotion || null,
        user_confirmed: false,
      })

      return {
        detected: true,
        moment: { type: parsed.type, title: parsed.title, description: parsed.description },
      }
    } catch {
      return { detected: false }
    }
  }, [])

  return { detect }
}
