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
  collected_at?: string | null
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
        message: `web_searchツールを使って、${topicPrompt} の最新ニュースを${limit}件検索してください。各ニュースは以下のJSON配列で返してください:\n[{"title":"タイトル（日本語）","summary":"2-3文の日本語要約。英語の記事や論文も必ず日本語で要約する。何が重要なのか、どう使えるかを含める","url":"記事URL","source":"ソース名","topic":"トピック","date":"YYYY-MM-DD"}]\n最終回答はJSON配列のみ返してください。説明文は不要です。`,
        system_prompt: 'あなたはニュース収集エージェントです。web_searchツールで最新ニュースを検索し、結果をJSON配列形式で返してください。titleとsummaryは必ず日本語で書いてください。英語の記事や論文も日本語に翻訳して要約します。',
        model: 'gpt-5-mini',
        max_tokens: 2000,
      }),
    },
  )

  if (!res.ok) {
    throw new Error(`Edge Function error: ${res.status}`)
  }

  // Response is SSE stream — assemble delta tokens into full text
  const text = await parseSSEResponse(res)

  // Parse JSON array from response (may be wrapped in markdown code block)
  const items = parseNewsResponse(text)
  if (items.length === 0) return { count: 0, items: [] }

  // Save to news_items table (parallel inserts)
  const validItems = items.filter((n) => n.title?.length > 5)
  await Promise.all(
    validItems.map((n) =>
      supabase.from('news_items').insert({
        title: n.title.substring(0, 200),
        summary: (n.summary || '').substring(0, 500),
        url: n.url || null,
        source: (n.source || '').substring(0, 50) as string,
        topic: (n.topic || '').substring(0, 30) as string,
        published_date: (n.date || null) as string | null,
      } as Record<string, unknown>),
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
    .select('id,title,summary,url,source,topic,published_date,collected_at')
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

/** Parse SSE streaming response from ai-agent Edge Function, assembling delta tokens into text */
async function parseSSEResponse(res: Response): Promise<string> {
  const raw = await res.text()
  let assembled = ''
  for (const line of raw.split('\n')) {
    if (!line.startsWith('data: ')) continue
    try {
      const obj = JSON.parse(line.slice(6))
      if (obj.type === 'delta' && obj.content) assembled += obj.content
    } catch { /* skip non-JSON lines */ }
  }
  return assembled
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
