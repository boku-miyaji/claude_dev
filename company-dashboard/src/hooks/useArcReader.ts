import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ArcReaderResult } from '@/types/narrator'

/**
 * Arc Reader — 感情の推移を物語構造として解釈するエンジン（読み取り専用）。
 *
 * 2026-04-21 以降、ブラウザ側では LLM を呼び出さない。
 * 生成は夜間バッチ (narrator-update / runArcReader, claude-opus-4-7) が担当し、
 * 結果は story_memory (memory_type='current_arc') に保存される。
 * この hook はその結果を読み込んで UI に表示するだけの責務を持つ。
 *
 * design-philosophy ⑫: 受動生成は claude-opus-4-7 バッチ一本化。
 * ブラウザから LLM を叩く二重実装をやめ、モデル分岐の混乱を排除する。
 */
export function useArcReader() {
  const [arc, setArc] = useState<ArcReaderResult | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (): Promise<ArcReaderResult | null> => {
    setLoading(true)
    try {
      const { data: cached } = await supabase
        .from('story_memory')
        .select('content, updated_at')
        .eq('memory_type', 'current_arc')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (cached?.content) {
        const result = cached.content as unknown as ArcReaderResult
        setArc(result)
        return result
      }
      return null
    } catch (err) {
      console.error('[Arc Reader] Read error:', err)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-load on mount
  useEffect(() => {
    load()
  }, [load])

  // refresh() は明示的なユーザーアクション（ボタン起動等）に備えて残す。
  // design-philosophy ⑪: 明示要求は能動扱い。現時点では story_memory の再読み込みだけを行い、
  // 生成が必要な場合は narrator-update の manual_refresh を別途呼び出す設計。
  return { arc, loading, refresh: load }
}
