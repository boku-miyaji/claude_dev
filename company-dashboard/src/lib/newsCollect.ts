import { supabase } from '@/lib/supabase'

/** Shape of a news item returned from AI and stored in news_items table */
export interface NewsItem {
  id?: string
  title: string
  title_ja?: string | null
  summary: string
  url: string | null
  source: string
  source_type?: string | null
  topic: string
  published_date?: string | null
  collected_at?: string | null
  click_count?: number
}


/**
 * Collect latest news via news-collect Edge Function.
 * Fetches from Google News RSS, arXiv, Hacker News, and official RSS feeds in parallel.
 * Saves results to news_items table and returns the saved items.
 */
export async function collectNews(): Promise<{ count: number; items: NewsItem[] }> {
  const { data: { session } } = await supabase.auth.getSession()
  // Fall back to the anon key when no mobile session exists — the edge function
  // runs with the service role internally, any valid Supabase JWT is accepted.
  const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY

  const res = await fetch(
    import.meta.env.VITE_SUPABASE_URL + '/functions/v1/news-collect',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
    },
  )

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`news-collect ${res.status}: ${body.slice(0, 200)}`)
  }

  const result = await res.json()

  // Return fresh items from DB (today only)
  const items = await loadNews(15)
  return { count: result.saved || 0, items }
}

/**
 * Translate a single news item to Japanese on demand.
 * Invokes news-enrich with { id } so the edge function fetches URL content,
 * asks the LLM for a Japanese title + summary, and writes them back to
 * news_items.title_ja / summary. Returns the refreshed row.
 */
export async function translateNewsItem(newsId: string): Promise<NewsItem | null> {
  const idNum = parseInt(newsId, 10)
  if (!Number.isFinite(idNum)) return null

  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY

  const res = await fetch(
    import.meta.env.VITE_SUPABASE_URL + '/functions/v1/news-enrich',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ id: idNum }),
    },
  )
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`news-enrich ${res.status}: ${body.slice(0, 200)}`)
  }

  const { data, error } = await supabase
    .from('news_items')
    .select('id,title,title_ja,summary,url,source,source_type,topic,published_date,collected_at')
    .eq('id', idNum)
    .single()
  if (error || !data) return null
  return data as NewsItem
}

/** Record a click on a news item (for interest tracking) */
export async function recordClick(newsId: string): Promise<void> {
  await supabase.rpc('record_news_click', { news_id: parseInt(newsId, 10) })
}

/** Record impressions for displayed news items */
export async function recordImpressions(newsIds: string[]): Promise<void> {
  if (newsIds.length === 0) return
  for (const id of newsIds) {
    supabase.rpc('increment_impression', { news_id: parseInt(id, 10) }).then(() => {})
  }
}

/** Load saved news items from news_items table.
 *
 * ソート順は published_date 降順が主、collected_at 降順が補助。
 * これにより一番「新しい」ニュースが必ず最上位に来る。
 * collected_at 順だと、古い記事を再取得したときに最上位に来てしまい
 * 一覧が古く見える問題があった。
 *
 * URL / title の重複は取得後に排除する。
 */
export async function loadNews(limit = 10): Promise<NewsItem[]> {
  const threshold = new Date()
  threshold.setDate(threshold.getDate() - 7)
  threshold.setHours(0, 0, 0, 0)

  try {
    // published_date が NULL のレコードが混ざるため、タイブレーカーとして
    // collected_at も order に含める。これが無いと limit の違いで Today と
    // News タブの並びがズレる（NULL バケットの並びが非決定的になる）。
    const { data, error } = await supabase
      .from('news_items')
      .select('id,title,title_ja,summary,url,source,source_type,topic,published_date,collected_at')
      .gte('collected_at', threshold.toISOString())
      .order('published_date', { ascending: false })
      .order('collected_at', { ascending: false })
      .limit(limit * 3) // dedupe 後に limit 件残るよう多めに取る

    if (error) {
      console.error('[loadNews] query error:', error)
      return []
    }

    const rows = (data as NewsItem[]) || []

    // URL と title で重複排除（published_date が新しい方を残す）
    const seen = new Set<string>()
    const deduped: NewsItem[] = []
    for (const item of rows) {
      const key = item.url || item.title
      if (!key || seen.has(key)) continue
      seen.add(key)
      deduped.push(item)
      if (deduped.length >= limit) break
    }
    return deduped
  } catch (e) {
    console.error('[loadNews] exception:', e)
    return []
  }
}

