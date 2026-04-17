import { supabase } from '@/lib/supabase'
import { aiCompletion } from '@/lib/edgeAi'

/**
 * Hybrid Search: emotion vector similarity + keyword search + gpt-nano reranking.
 *
 * 1. Emotion vector search (cosine similarity on Plutchik 8 dimensions)
 * 2. PGroonga keyword search on diary_entries
 * 3. Merge & deduplicate results
 * 4. gpt-nano reranking based on query relevance
 * 5. Return top-K results for main LLM context injection
 */

interface SearchResult {
  id: number
  body: string
  entry_date: string
  wbi: number | null
  created_at: string
  score: number       // reranking score (0-1)
  source: 'emotion' | 'keyword' | 'both'
}

interface EmotionVector {
  joy: number
  trust: number
  fear: number
  surprise: number
  sadness: number
  disgust: number
  anger: number
  anticipation: number
}

/**
 * Build emotion vector string for pgvector query
 */
function toVectorString(e: EmotionVector): string {
  return `[${e.joy},${e.trust},${e.fear},${e.surprise},${e.sadness},${e.disgust},${e.anger},${e.anticipation}]`
}

/**
 * Search by emotion similarity: find diary entries with similar emotional patterns
 */
export async function searchByEmotion(
  emotions: EmotionVector,
  threshold = 0.7,
  limit = 10,
): Promise<{ diary_entry_id: string; similarity: number; created_at: string }[]> {
  const { data } = await supabase.rpc('match_similar_emotions', {
    query_vector: toVectorString(emotions),
    match_threshold: threshold,
    match_count: limit,
  })
  return (data || []) as { diary_entry_id: string; similarity: number; created_at: string }[]
}

/**
 * Search by keyword (PGroonga full-text search on Japanese text)
 */
export async function searchByKeyword(
  query: string,
  limit = 10,
): Promise<{ id: number; body: string; entry_date: string; created_at: string }[]> {
  const { data } = await supabase.rpc('search_diary', {
    search_query: query,
    max_results: limit,
  })
  return (data || []) as { id: number; body: string; entry_date: string; created_at: string }[]
}

/**
 * Hybrid search: emotion + keyword → merge → gpt-nano rerank → return top results
 */
export async function hybridSearch(options: {
  query: string                    // user's question or context
  emotions?: EmotionVector         // optional emotion vector for similarity search
  keyword?: string                 // optional keyword for full-text search
  topK?: number                    // final number of results (default 5)
}): Promise<SearchResult[]> {
  const { query, emotions, keyword, topK = 5 } = options
  const candidates: Map<number, { body: string; entry_date: string; wbi: number | null; created_at: string; source: Set<string> }> = new Map()

  // 1. Emotion vector search
  if (emotions) {
    const emotionResults = await searchByEmotion(emotions, 0.6, 15)
    if (emotionResults.length > 0) {
      // Fetch diary bodies for matched entries
      const entryIds = emotionResults.map((r) => r.diary_entry_id).filter(Boolean)
      if (entryIds.length > 0) {
        const { data: diaries } = await supabase
          .from('diary_entries')
          .select('id, body, entry_date, wbi, created_at')
          .in('id', entryIds)
        for (const d of diaries || []) {
          const existing = candidates.get(d.id)
          if (existing) {
            existing.source.add('emotion')
          } else {
            candidates.set(d.id, { body: d.body, entry_date: d.entry_date, wbi: d.wbi, created_at: d.created_at, source: new Set(['emotion']) })
          }
        }
      }
    }
  }

  // 2. Keyword search
  if (keyword) {
    const keywordResults = await searchByKeyword(keyword, 15)
    for (const d of keywordResults) {
      const existing = candidates.get(d.id)
      if (existing) {
        existing.source.add('keyword')
      } else {
        candidates.set(d.id, { body: d.body, entry_date: d.entry_date, wbi: null, created_at: d.created_at, source: new Set(['keyword']) })
      }
    }
  }

  if (candidates.size === 0) return []

  // 3. gpt-nano reranking
  const candidateList = Array.from(candidates.entries()).map(([id, c]) => ({
    id,
    snippet: c.body.substring(0, 200),
    date: c.entry_date,
    source: Array.from(c.source).join('+'),
  }))

  try {
    const rerankResult = await aiCompletion(
      `## Query\n${query}\n\n## Candidates\n${JSON.stringify(candidateList.map((c, i) => ({ i, snippet: c.snippet, date: c.date })))}`,
      {
        systemPrompt: `あなたは検索結果のリランキングエンジン。ユーザーの質問/文脈に対して、各候補がどれだけ関連があるかを0.0-1.0のスコアで評価する。

出力: JSON配列 [{"i": 候補インデックス, "score": 0.0-1.0}]
- 直接関連あり → 0.8-1.0
- 間接的に関連 → 0.5-0.7
- 関連薄い → 0.0-0.4

スコアのみ返す。説明不要。`,
        jsonMode: true,
        temperature: 0,
        maxTokens: 200,
        source: 'search_rerank',
      },
    )

    const scores: { i: number; score: number }[] = JSON.parse(rerankResult.content)
    const scoreMap = new Map(scores.map((s) => [s.i, s.score]))

    const results: SearchResult[] = candidateList.map((c, i) => {
      const candidate = candidates.get(c.id)!
      const sourceArr = Array.from(candidate.source)
      return {
        id: c.id,
        body: candidate.body,
        entry_date: candidate.entry_date,
        wbi: candidate.wbi,
        created_at: candidate.created_at,
        score: scoreMap.get(i) ?? 0.5,
        source: sourceArr.length > 1 ? 'both' as const : sourceArr[0] as 'emotion' | 'keyword',
      }
    })

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
  } catch {
    // Reranking failed — return by source priority (both > emotion > keyword)
    const sourcePriority = { both: 0, emotion: 1, keyword: 2 }
    return Array.from(candidates.entries())
      .map(([id, c]) => {
        const sourceArr = Array.from(c.source)
        const src = sourceArr.length > 1 ? 'both' as const : sourceArr[0] as 'emotion' | 'keyword'
        return { id, body: c.body, entry_date: c.entry_date, wbi: c.wbi, created_at: c.created_at, score: 0.5, source: src }
      })
      .sort((a, b) => (sourcePriority[a.source] ?? 2) - (sourcePriority[b.source] ?? 2))
      .slice(0, topK)
  }
}

/**
 * Format search results for LLM context injection
 */
export function formatSearchContext(results: SearchResult[]): string {
  if (results.length === 0) return ''
  return results
    .map((r) => `[${r.entry_date}] (relevance: ${r.score.toFixed(1)}) ${r.body.substring(0, 200)}`)
    .join('\n')
}
