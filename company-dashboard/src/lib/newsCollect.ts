import { supabase } from '@/lib/supabase'

/** Shape of a news item returned from AI and stored in news_items table */
export interface NewsItem {
  id?: string
  title: string
  summary: string
  url: string | null
  source: string
  topic: string
  published_date?: string | null
}

const DEFAULT_TOPICS = 'AI/LLM、データプラットフォーム、Claude、OpenAI'

/**
 * Collect latest news via ai-agent Edge Function (agent mode + web_search).
 * Saves results to news_items table and returns the saved items.
 */
export async function collectNews(options?: {
  limit?: number
}): Promise<{ count: number; items: NewsItem[] }> {
  const limit = options?.limit ?? 5

  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token || ''

  // Build topic prompt from user preferences
  const topicPrompt = await buildTopicPrompt()

  // Call ai-agent in agent mode (not completion) so web_search tool is available
  const res = await fetch(
    import.meta.env.VITE_SUPABASE_URL + '/functions/v1/ai-agent',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        message: `web_searchツールを使って、${topicPrompt} の最新ニュースを${limit}件検索してください。各ニュースは以下のJSON配列で返してください:\n[{"title":"タイトル","summary":"1行要約","url":"記事URL","source":"ソース名","topic":"トピック","date":"YYYY-MM-DD"}]\n最終回答はJSON配列のみ返してください。説明文は不要です。`,
        system_prompt: 'あなたはニュース収集エージェントです。web_searchツールで最新ニュースを検索し、結果をJSON配列形式で返してください。',
        model: 'gpt-5-mini',
        max_tokens: 2000,
      }),
    },
  )

  if (!res.ok) {
    throw new Error(`Edge Function error: ${res.status}`)
  }

  const data = await res.json()
  const text: string = data.content || ''

  // Parse JSON array from response (may be wrapped in markdown code block)
  const items = parseNewsResponse(text)
  if (items.length === 0) return { count: 0, items: [] }

  // Save to news_items table (parallel inserts)
  const validItems = items.filter((n) => n.title?.length > 5)
  await Promise.all(
    validItems.map((n) =>
      supabase.from('news_items').insert({
        title: n.title.substring(0, 200),
        summary: (n.summary || '').substring(0, 300),
        url: n.url || null,
        source: (n.source || '').substring(0, 50),
        topic: (n.topic || '').substring(0, 30),
        published_date: n.date || null,
      }),
    ),
  )

  // Return fresh items from DB
  const { data: fresh } = await supabase
    .from('news_items')
    .select('id,title,summary,url,source,topic')
    .order('collected_at', { ascending: false })
    .limit(limit)

  return { count: validItems.length, items: (fresh as NewsItem[]) || [] }
}

/** Load saved news items from news_items table */
export async function loadNews(limit = 5): Promise<NewsItem[]> {
  const { data } = await supabase
    .from('news_items')
    .select('id,title,summary,url,source,topic')
    .order('collected_at', { ascending: false })
    .limit(limit)
  return (data as NewsItem[]) || []
}

/** Build topic prompt string from default topics + user preferences */
async function buildTopicPrompt(): Promise<string> {
  const { data } = await supabase
    .from('news_preferences')
    .select('topic,interest_score')
    .order('interest_score', { ascending: false })
  const topTopics = (data || [])
    .filter((p: { interest_score: number }) => p.interest_score >= 0.5)
    .map((p: { topic: string }) => p.topic)

  if (topTopics.length > 0) {
    return DEFAULT_TOPICS + '、' + topTopics.join('、')
  }
  return DEFAULT_TOPICS
}

/** Parse AI response into news items array, with line-based fallback */
function parseNewsResponse(text: string): Array<{ title: string; summary: string; url: string | null; source: string; topic: string; date: string | null }> {
  // Try JSON array extraction
  const match = text.match(/\[[\s\S]*\]/)
  if (match) {
    try {
      const parsed = JSON.parse(match[0])
      const arr = Array.isArray(parsed) ? parsed : (parsed.news || parsed.items || [parsed])
      return arr
    } catch { /* fall through to line-based parsing */ }
  }

  // Fallback: line-based parsing
  const lines = text.split('\n').filter((l) => l.trim().length > 15 && !l.includes('？'))
  return lines.slice(0, 5).map((l) => ({
    title: l.replace(/^[-*\d.]\s*/, '').substring(0, 200),
    summary: '',
    url: null,
    source: '',
    topic: 'misc',
    date: null,
  }))
}
