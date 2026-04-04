import { supabase } from '@/lib/supabase'

interface CompletionOptions {
  systemPrompt?: string
  model?: string
  temperature?: number
  maxTokens?: number
  jsonMode?: boolean
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

  return res.json()
}
