import { supabase } from '@/lib/supabase'

/** Shape of a news item returned from AI and stored in news_items table */
export interface NewsItem {
  id?: string
  title: string
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
  const token = session?.access_token || ''

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
    throw new Error(`news-collect error: ${res.status}`)
  }

  const result = await res.json()

  // Return fresh items from DB (today only)
  const items = await loadNews(15)
  return { count: result.saved || 0, items }
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

/** Load saved news items from news_items table (today only by default) */
export async function loadNews(limit = 10): Promise<NewsItem[]> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const { data } = await supabase
    .from('news_items')
    .select('id,title,summary,url,source,source_type,topic,published_date,collected_at')
    .gte('collected_at', today.toISOString())
    .order('collected_at', { ascending: false })
    .limit(limit)
  return (data as NewsItem[]) || []
}

