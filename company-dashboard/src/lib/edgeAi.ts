import { supabase } from '@/lib/supabase'

interface CompletionOptions {
  systemPrompt?: string
  model?: string
  temperature?: number
  maxTokens?: number
  jsonMode?: boolean
  /** Source label for cost tracking (e.g. 'self_analysis', 'dream_classify') */
  source?: string
}

interface CompletionResult {
  content: string
  model: string
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

/**
 * Call the ai-agent Edge Function in completion mode.
 * Simple prompt → response, no conversation or agent loop.
 * API key is server-side only (Edge Function env var).
 * Automatically logs cost to api_cost_log table.
 */
export async function aiCompletion(
  message: string,
  options: CompletionOptions = {},
): Promise<CompletionResult> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token || ''

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
        mode: 'completion',
        message,
        system_prompt: options.systemPrompt,
        model: options.model || 'gpt-5-nano',
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 1000,
        response_format: options.jsonMode ? { type: 'json_object' } : undefined,
      }),
    },
  )

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`Edge Function error: ${res.status} ${errBody.substring(0, 200)}`)
  }

  const result: CompletionResult = await res.json()

  // Log cost in background (don't block the caller)
  if (result.usage || result.model) {
    const tokIn = result.usage?.prompt_tokens || 0
    const tokOut = result.usage?.completion_tokens || 0
    // Estimate cost if not provided (GPT-5-nano ~$0.10/1M in, $0.40/1M out)
    const costUsd = (tokIn * 0.0000001) + (tokOut * 0.0000004)
    supabase.from('api_cost_log').insert({
      source: options.source || 'other',
      model: result.model || options.model || 'gpt-5-nano',
      tokens_input: tokIn,
      tokens_output: tokOut,
      cost_usd: costUsd,
      prompt_summary: message.substring(0, 100),
    }).then(() => {})
  }

  return result
}

export interface PartnerChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Call the ai-agent Edge Function in partner_chat mode.
 * 未来のあなた v4 チャット専用。v4 のシステムプロンプト（日記・大局的傾向・夢）を
 * サーバー側で自動注入して応答する。chat_interactions に自動記録される。
 */
export async function aiPartnerChat(
  message: string,
  history: PartnerChatMessage[] = [],
  options: { sessionId?: string; entryPoint?: string } = {},
): Promise<{ content: string; model: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token || ''

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
        mode: 'partner_chat',
        message,
        history,
        session_id: options.sessionId,
        entry_point: options.entryPoint || 'today_partner',
      }),
    },
  )

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`Edge Function error: ${res.status} ${errBody.substring(0, 200)}`)
  }

  const data = await res.json()
  return { content: data.content || '', model: data.model || 'unknown' }
}
