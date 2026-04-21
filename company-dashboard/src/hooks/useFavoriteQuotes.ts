import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Favorite Quotes (お気に入り名言一覧) — Journal 画面のタブで表示する用。
 * 保存日降順。解除関数付き。
 */
export interface FavoriteQuote {
  /** user_quote_favorites.id */
  favoriteId: string
  quoteId: string
  body: string
  bodyLang: 'ja' | 'en'
  author: string
  authorEra: string | null
  source: string | null
  sourceUrl: string | null
  /** お気に入り保存日時 (ISO) */
  favoritedAt: string
}

interface UseFavoriteQuotesResult {
  quotes: FavoriteQuote[]
  loading: boolean
  /** お気に入り解除 (楽観的 UI: 即座にリストから消す → DB 反映) */
  removeFavorite: (quoteId: string) => Promise<void>
  /** 再取得 */
  refresh: () => Promise<void>
}

export function useFavoriteQuotes(): UseFavoriteQuotesResult {
  const [quotes, setQuotes] = useState<FavoriteQuote[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setQuotes([])
        return
      }

      const { data, error } = await supabase
        .from('user_quote_favorites')
        .select('id, quote_id, created_at, quotes(id, body, body_lang, author, author_era, source, source_url)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('[Favorite Quotes] load error:', error)
        setQuotes([])
        return
      }

      const rows: FavoriteQuote[] = (data ?? [])
        .map((row) => {
          const q = Array.isArray(row.quotes) ? row.quotes[0] : row.quotes
          if (!q) return null
          return {
            favoriteId: row.id as string,
            quoteId: (q.id ?? row.quote_id) as string,
            body: q.body as string,
            bodyLang: (q.body_lang ?? 'ja') as 'ja' | 'en',
            author: q.author as string,
            authorEra: (q.author_era ?? null) as string | null,
            source: (q.source ?? null) as string | null,
            sourceUrl: (q.source_url ?? null) as string | null,
            favoritedAt: row.created_at as string,
          }
        })
        .filter((r): r is FavoriteQuote => r !== null)
      setQuotes(rows)
    } catch (err) {
      console.error('[Favorite Quotes] load error:', err)
      setQuotes([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const removeFavorite = useCallback(async (quoteId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const prev = quotes
    setQuotes((cur) => cur.filter((q) => q.quoteId !== quoteId))
    try {
      const { error } = await supabase
        .from('user_quote_favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('quote_id', quoteId)
      if (error) throw error
    } catch (err) {
      console.error('[Favorite Quotes] remove error:', err)
      // 失敗時は元に戻す
      setQuotes(prev)
    }
  }, [quotes])

  return { quotes, loading, removeFavorite, refresh: load }
}
