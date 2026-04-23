import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface ThemeFinderResult {
  identity: string           // 通底テーマ（「意味を問う人」等）
  emotionalDNA: {
    joyTriggers: string[]    // 喜びのトリガー
    energySources: string[]  // エネルギー源
    recoveryStyle: string    // 回復スタイル
  }
  aspirations: string        // 志向性の要約
  change_summary?: string    // 前回との差分（バッチが生成、Homeバナーに表示）
}

/**
 * Theme Finder — 長期データから人生テーマを発見するエンジン（読み取り専用）。
 *
 * 2026-04-21 以降、ブラウザ側では LLM を呼び出さない。
 * 生成は夜間バッチ (narrator-update / runThemeFinder, claude-opus-4-7) が担当し、
 * 結果は story_memory (memory_type='identity' / 'emotional_dna' / 'aspirations')
 * に保存される。この hook はその結果を読み込んで UI に表示するだけ。
 *
 * アンロック条件（日記30件以上）はバッチ側で判定するため、
 * この hook は story_memory にレコードが存在するかどうかで `unlocked` を決める。
 */
export function useThemeFinder() {
  const [theme, setTheme] = useState<ThemeFinderResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  const load = useCallback(async (): Promise<ThemeFinderResult | null> => {
    setLoading(true)
    try {
      const { data: cached } = await supabase
        .from('story_memory')
        .select('content, updated_at')
        .eq('memory_type', 'identity')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (cached?.content) {
        const result = cached.content as unknown as ThemeFinderResult
        setTheme(result)
        setUnlocked(true)
        setUpdatedAt(cached.updated_at ?? null)
        return result
      }

      setUnlocked(false)
      return null
    } catch (err) {
      console.error('[Theme Finder] Read error:', err)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // refresh() は明示要求（ボタン等）のために残す。ここでは story_memory の再読み込みのみ。
  // 再生成が必要な場合は narrator-update の manual_refresh を別途呼び出す。
  return { theme, loading, unlocked, refresh: load, updatedAt }
}
