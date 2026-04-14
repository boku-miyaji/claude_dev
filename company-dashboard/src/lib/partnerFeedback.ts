import { supabase } from '@/lib/supabase'

/**
 * AI Partner feedback loop.
 *
 * Stores good examples and corrections the user provides, then selects a
 * balanced subset (across categories and feedback types) to inject as
 * few-shot examples into the next prompt generation.
 *
 * Design goal: avoid local-optimum bias where a recent cluster of
 * corrections (e.g. all "rest_mode") skews the partner toward one pattern.
 * Balance by category + feedback_type + recency inside each bucket.
 */

export type FeedbackCategory =
  | 'challenge_mode'
  | 'rest_mode'
  | 'observation'
  | 'danger'
  | 'over_advice'
  | 'direction'
  | 'jargon'
  | 'other'

export interface PartnerFeedback {
  id: number
  created_at: string
  feedback_type: 'good' | 'correction'
  diary_entry_id: number | null
  context_snapshot: Record<string, unknown> | null
  actual_output: string
  desired_output: string | null
  reason: string | null
  category: FeedbackCategory | null
  active: boolean
  promoted: boolean
}

export const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  challenge_mode: '挑戦モードへの応答',
  rest_mode: '休息モードへの応答',
  observation: '観察・共感',
  danger: '危険の兆候',
  over_advice: 'アドバイス過多',
  direction: '意図の方向',
  jargon: '専門用語・クリシェ',
  other: 'その他',
}

/** Insert a "good" (positive) feedback row. */
export async function saveGoodFeedback(args: {
  actualOutput: string
  diaryEntryId?: number | null
  contextSnapshot?: Record<string, unknown>
  category?: FeedbackCategory
}): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { error } = await supabase.from('ai_partner_feedback').insert({
    user_id: user.id,
    feedback_type: 'good',
    actual_output: args.actualOutput,
    diary_entry_id: args.diaryEntryId ?? null,
    context_snapshot: args.contextSnapshot ?? null,
    category: args.category ?? null,
  })
  if (error) console.error('[partnerFeedback] saveGood failed', error)
  return !error
}

/** Insert a "correction" (negative → desired) feedback row. */
export async function saveCorrectionFeedback(args: {
  actualOutput: string
  desiredOutput: string
  reason?: string
  category?: FeedbackCategory
  diaryEntryId?: number | null
  contextSnapshot?: Record<string, unknown>
}): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { error } = await supabase.from('ai_partner_feedback').insert({
    user_id: user.id,
    feedback_type: 'correction',
    actual_output: args.actualOutput,
    desired_output: args.desiredOutput,
    reason: args.reason ?? null,
    category: args.category ?? null,
    diary_entry_id: args.diaryEntryId ?? null,
    context_snapshot: args.contextSnapshot ?? null,
  })
  if (error) console.error('[partnerFeedback] saveCorrection failed', error)
  return !error
}

export interface PromptRule {
  id: number
  category: string | null
  rule: string
  active: boolean
}

/**
 * Fetch a balanced selection for few-shot injection.
 *
 * Budget: goodBudget goods + correctionBudget corrections (default 3 + 7).
 * Within each budget, round-robin across categories to avoid bias from
 * a single recent cluster. Within a category, prefer most recent.
 */
export async function fetchBalancedFeedback(
  goodBudget = 3,
  correctionBudget = 7,
): Promise<PartnerFeedback[]> {
  const { data, error } = await supabase
    .from('ai_partner_feedback')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error || !data) return []

  const rows = data as PartnerFeedback[]
  const goods = rows.filter((r) => r.feedback_type === 'good')
  const corrs = rows.filter((r) => r.feedback_type === 'correction')

  return [
    ...roundRobinByCategory(goods, goodBudget),
    ...roundRobinByCategory(corrs, correctionBudget),
  ]
}

/**
 * Pick up to `budget` rows by walking category buckets in round-robin order,
 * preferring the most recent row in each bucket. Ensures diversity across
 * categories instead of pure recency.
 */
function roundRobinByCategory(rows: PartnerFeedback[], budget: number): PartnerFeedback[] {
  if (budget <= 0 || rows.length === 0) return []
  const buckets = new Map<string, PartnerFeedback[]>()
  for (const r of rows) {
    const key = r.category ?? 'other'
    const arr = buckets.get(key) ?? []
    arr.push(r)
    buckets.set(key, arr)
  }
  const out: PartnerFeedback[] = []
  while (out.length < budget) {
    let picked = 0
    for (const arr of buckets.values()) {
      if (arr.length === 0) continue
      out.push(arr.shift()!)
      picked++
      if (out.length >= budget) break
    }
    if (picked === 0) break
  }
  return out
}

/**
 * Fetch active custom prompt rules (promoted from repeated corrections).
 * These are rendered into the system prompt's 禁止 section as permanent rules.
 */
export async function fetchActivePromptRules(): Promise<PromptRule[]> {
  const { data, error } = await supabase
    .from('ai_partner_prompt_rules')
    .select('id, category, rule, active')
    .eq('active', true)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data as PromptRule[]
}

/**
 * Build the few-shot block to append to the system prompt.
 * Returns empty string if no feedback rows are available.
 */
export function buildFewShotBlock(
  feedback: PartnerFeedback[],
  rules: PromptRule[],
): string {
  const parts: string[] = []

  if (rules.length > 0) {
    parts.push(
      '## 本人から昇格された恒久ルール（絶対に守る）\n' +
        rules.map((r, i) => `${i + 1}. ${r.rule}`).join('\n'),
    )
  }

  const goods = feedback.filter((f) => f.feedback_type === 'good')
  const corrs = feedback.filter((f) => f.feedback_type === 'correction')

  if (goods.length > 0) {
    const lines = goods.map((g, i) => {
      const ctx = summarizeContext(g.context_snapshot)
      return `${i + 1}. 【状況】${ctx}\n  【本人が良しとした応答】${g.actual_output}`
    })
    parts.push('## 本人から「これは良かった」と承認された実例\n' + lines.join('\n\n'))
  }

  if (corrs.length > 0) {
    const lines = corrs.map((c, i) => {
      const ctx = summarizeContext(c.context_snapshot)
      return [
        `${i + 1}. 【状況】${ctx}`,
        `  【AIが返してしまった応答（NG）】${c.actual_output}`,
        `  【本人が本当に欲しかった応答】${c.desired_output ?? '(未記入)'}`,
        c.reason ? `  【なぜNGか】${c.reason}` : null,
      ]
        .filter(Boolean)
        .join('\n')
    })
    parts.push(
      '## 本人から「これは違う」と指摘された実例（同じ失敗を絶対にしない）\n' +
        lines.join('\n\n'),
    )
  }

  if (parts.length === 0) return ''
  return '\n\n' + parts.join('\n\n') + '\n'
}

function summarizeContext(ctx: Record<string, unknown> | null): string {
  if (!ctx) return '(文脈情報なし)'
  const diary = typeof ctx.diary === 'string' ? ctx.diary : null
  const mode = typeof ctx.time_mode === 'string' ? ctx.time_mode : null
  const parts: string[] = []
  if (mode) parts.push(`時間帯:${mode}`)
  if (diary) parts.push(`日記:「${diary.substring(0, 120)}${diary.length > 120 ? '…' : ''}」`)
  return parts.length > 0 ? parts.join(' / ') : '(文脈情報なし)'
}
