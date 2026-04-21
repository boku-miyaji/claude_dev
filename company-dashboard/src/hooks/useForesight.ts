import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Foresight as Question の結果。
 *
 * design-philosophy ⑫ (2026-04-21) により、旧「予測型 (insight)」から
 * 「過去の引用 + 問い (question)」へ概念シフト。
 * 予言ではなく、本人の過去に光を当てて本人自身の答えを呼び起こす問い。
 *
 * `insight` は旧データ互換のため残す（story_memory に旧フォーマットが残っている可能性）。
 * UI は `question || insight` の順で参照すること。
 */
export interface ForesightResult {
  /** 過去のパターンを引用し「あの時どうした？」と問う一文 */
  question?: string
  /** @deprecated 旧「予測の一言」フォーマット。新規生成は question を使う */
  insight?: string
  /** どの過去データ（日付・状況）を引いたかの根拠 */
  basis: string
  /** design-philosophy ⑩: model chose silence when no clear pattern connection */
  silent?: boolean
}

/**
 * Foresight as Question — 過去パターンから「問い」を立てるエンジン（読み取り専用）。
 *
 * 2026-04-21 以降、ブラウザ側では LLM を呼び出さない。
 * 生成は夜間バッチ (narrator-update, claude-opus-4-7) が担当し、
 * 結果は story_memory (memory_type='current_foresight') に保存される予定。
 * この hook はその結果を読み込んで UI に表示するだけの責務。
 *
 * design-philosophy ⑫: Foresight Engine → Foresight as Question に再定義。
 * 未来予言ではなく、「今日は2月の第3週と似ています。あの時どう動きましたか?」
 * のような、過去の類似パターンを引用する問い。
 *
 * design-philosophy ⑩ Silence over Noise: silent=true や
 * question/insight が欠けている場合は null を返して表示を抑制する。
 *
 * プロンプト内容の書き換え・生成側の実装は narrator-update 側 (P1 以降) で行う。
 * この hook は読み取り専任。
 */
export function useForesight() {
  const [foresight, setForesight] = useState<ForesightResult | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (): Promise<ForesightResult | null> => {
    setLoading(true)
    try {
      const { data: cached } = await supabase
        .from('story_memory')
        .select('content, updated_at')
        .eq('memory_type', 'current_foresight')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (cached?.content) {
        const result = cached.content as unknown as ForesightResult
        // design-philosophy ⑩: respect silence signal from generator.
        // Also guard against empty payload (either question or legacy insight must exist).
        if (result.silent || (!result.question && !result.insight)) {
          setForesight(null)
          return null
        }
        setForesight(result)
        return result
      }
      return null
    } catch (err) {
      console.error('[Foresight] Read error:', err)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // refresh() は明示要求のために残す。再生成は narrator-update を別途呼び出す。
  return { foresight, loading, refresh: load }
}
