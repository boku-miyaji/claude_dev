import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * 過去の自分カード — 今書いている日記と意味が近い過去のエントリを返す。
 *
 * 設計思想: コーチが原理的にできない「ユーザーが忘れた範囲の自己」を提示する。
 * Embedding だけで実装できるので LLM コスト不要。14 日より古いエントリのみ対象
 * (直近の似た内容は「覚えている範囲」なので出しても嬉しくない)。
 */

export interface SimilarPastEntry {
  id: number
  entry_date: string
  body: string
  similarity: number
}

interface UseSimilarPastEntryOptions {
  /** デバウンス (ms)。ユーザーがタイピング中に連打するのを防ぐ */
  debounceMs?: number
  /** 最低文字数 — これより短いテキストは検索しない */
  minChars?: number
  /** 最低類似度 — これ未満は「似ていない」として表示しない */
  minSimilarity?: number
  /** 何件返すか */
  matchCount?: number
  /** 除外する id (編集中の自分の日記) */
  excludeId?: number | null
}

export function useSimilarPastEntry(text: string, options: UseSimilarPastEntryOptions = {}) {
  const {
    debounceMs = 1500,
    minChars = 20,
    minSimilarity = 0.35,
    matchCount = 2,
    excludeId = null,
  } = options

  const [entries, setEntries] = useState<SimilarPastEntry[]>([])
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const search = useCallback(
    async (query: string) => {
      if (query.trim().length < minChars) {
        setEntries([])
        return
      }
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      setLoading(true)
      try {
        // Get embedding via edge function
        const { data: fn, error: fnErr } = await supabase.functions.invoke('diary-embed', {
          body: { text: query },
        })
        if (fnErr || !fn?.embedding) {
          if (!ctrl.signal.aborted) setEntries([])
          return
        }
        if (ctrl.signal.aborted) return

        // Similarity search RPC
        const { data, error } = await supabase.rpc('match_similar_diary_entries', {
          query_embedding: fn.embedding,
          exclude_id: excludeId,
          days_ago_min: 14,
          match_count: matchCount,
        })
        if (ctrl.signal.aborted) return
        if (error || !data) {
          setEntries([])
          return
        }
        const filtered = (data as SimilarPastEntry[]).filter((e) => e.similarity >= minSimilarity)
        setEntries(filtered)
      } catch (err) {
        if (!ctrl.signal.aborted) {
          console.error('[useSimilarPastEntry] search failed', err)
          setEntries([])
        }
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    },
    [minChars, minSimilarity, matchCount, excludeId],
  )

  // Debounced effect
  useEffect(() => {
    const t = setTimeout(() => {
      search(text)
    }, debounceMs)
    return () => clearTimeout(t)
  }, [text, debounceMs, search])

  return { entries, loading }
}
