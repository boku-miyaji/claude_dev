import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Morning Quote (朝イチ名言) — 日次バッチが配信した今日の1件を読み取る。
 *
 * バッチ: scripts/morning-quote/ (Claude CLI + WebSearch)
 *   - 06:30 JST cron (.github/workflows/morning-quote.yml)
 *   - 前日の日記・感情分析からテーマ抽出 → 検索 → スコアリング → 1件配信
 * この hook はバッチが user_quote_deliveries に書いた結果を読むだけ。
 *
 * design-philosophy ⑪: 完全な受動表示。ブラウザ側から再生成しない。
 * design-philosophy ⑩: 未配信 or 日記0件ならセクション非表示（quote=null）。
 */
export interface MorningQuote {
  /** user_quote_deliveries.id（お気に入りとは別のID） */
  deliveryId: string
  /** quotes.id — お気に入り INSERT/DELETE のキー */
  quoteId: string
  body: string
  bodyLang: 'ja' | 'en'
  author: string
  authorEra: string | null
  source: string | null
  sourceUrl: string | null
}

interface UseMorningQuoteResult {
  quote: MorningQuote | null
  loading: boolean
  isFavorited: boolean
  /** ハート押下。楽観的 UI: 即座に isFavorited を反転 → DB 反映。失敗時は戻す */
  toggleFavorite: () => Promise<void>
}

/** JST の今日（YYYY-MM-DD） */
function getTodayStrJST(): string {
  const now = new Date()
  const jst = new Date(now.getTime() + (9 * 60 + now.getTimezoneOffset()) * 60000)
  return `${jst.getFullYear()}-${String(jst.getMonth() + 1).padStart(2, '0')}-${String(jst.getDate()).padStart(2, '0')}`
}

export function useMorningQuote(): UseMorningQuoteResult {
  const [quote, setQuote] = useState<MorningQuote | null>(null)
  const [loading, setLoading] = useState(true)
  const [isFavorited, setIsFavorited] = useState(false)

  /** 今日ぶんの配信 1件 + お気に入り状態を取得する */
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const today = getTodayStrJST()
      // 今日の配信 1件 (quotes を JOIN)。fallback_reason がある行も含めて取得し、
      // quote_id が null（スターター配信）の場合は表示しないよう後段でフィルタ
      const { data: delivery, error: dErr } = await supabase
        .from('user_quote_deliveries')
        .select('id, quote_id, fallback_reason, quotes(id, body, body_lang, author, author_era, source, source_url)')
        .eq('delivery_date', today)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (dErr || !delivery || !delivery.quote_id || !delivery.quotes) {
        setQuote(null)
        setIsFavorited(false)
        return
      }

      // Supabase の JOIN 結果は array or object（多対一の場合 object）。両対応
      const q = Array.isArray(delivery.quotes) ? delivery.quotes[0] : delivery.quotes
      if (!q) {
        setQuote(null)
        setIsFavorited(false)
        return
      }

      const mq: MorningQuote = {
        deliveryId: delivery.id as string,
        quoteId: q.id as string,
        body: q.body as string,
        bodyLang: (q.body_lang ?? 'ja') as 'ja' | 'en',
        author: q.author as string,
        authorEra: (q.author_era ?? null) as string | null,
        source: (q.source ?? null) as string | null,
        sourceUrl: (q.source_url ?? null) as string | null,
      }
      setQuote(mq)

      // お気に入り状態
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: fav } = await supabase
          .from('user_quote_favorites')
          .select('id')
          .eq('user_id', user.id)
          .eq('quote_id', mq.quoteId)
          .maybeSingle()
        setIsFavorited(Boolean(fav))
      } else {
        setIsFavorited(false)
      }
    } catch (err) {
      console.error('[Morning Quote] load error:', err)
      setQuote(null)
      setIsFavorited(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const toggleFavorite = useCallback(async () => {
    if (!quote) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const prev = isFavorited
    // Optimistic flip
    setIsFavorited(!prev)
    try {
      if (prev) {
        const { error } = await supabase
          .from('user_quote_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('quote_id', quote.quoteId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('user_quote_favorites')
          .insert({ user_id: user.id, quote_id: quote.quoteId })
        // UNIQUE violation は冪等扱い（既にお気に入り済み）
        if (error && !/duplicate|23505/i.test(error.message)) throw error
      }
    } catch (err) {
      console.error('[Morning Quote] toggle favorite error:', err)
      // 失敗時は元に戻す
      setIsFavorited(prev)
    }
  }, [quote, isFavorited])

  return { quote, loading, isFavorited, toggleFavorite }
}
