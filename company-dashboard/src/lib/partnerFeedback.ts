import { supabase } from '@/lib/supabase'
import { aiCompletion } from '@/lib/edgeAi'

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
  if (!error) maybeDistillInBackground()
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
  if (!error) maybeDistillInBackground()
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

// ============================================================
// Distilled lessons — LLM-curated summary of raw feedback
// ============================================================

export interface DistilledLesson {
  id: number
  created_at: string
  content: string
  source_count: number
  active: boolean
}

/** Fetch the most recent active distilled lesson (if any). */
export async function fetchLatestDistilledLesson(): Promise<DistilledLesson | null> {
  const { data, error } = await supabase
    .from('ai_partner_distilled_lessons')
    .select('id, created_at, content, source_count, active')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return data as DistilledLesson
}

/**
 * Build the block to append to the system prompt. Uses LLM-distilled
 * lessons (preferred) plus any promoted permanent rules. Raw feedback is
 * never injected directly — it's first curated and abstracted by the
 * distillation step to avoid local-optimum bias and prompt bloat.
 */
export function buildFewShotBlock(
  distilled: DistilledLesson | null,
  rules: PromptRule[],
): string {
  const parts: string[] = []

  if (rules.length > 0) {
    parts.push(
      '## 本人から昇格された恒久ルール（絶対に守る）\n' +
        rules.map((r, i) => `${i + 1}. ${r.rule}`).join('\n'),
    )
  }

  if (distilled) {
    parts.push(
      `## 本人からのフィードバックから蒸留された学び（${distilled.source_count}件のフィードバックから）\n` +
        distilled.content,
    )
  }

  if (parts.length === 0) return ''
  return '\n\n' + parts.join('\n\n') + '\n'
}

// ============================================================
// Distillation — LLM curates raw feedback into abstract lessons
// ============================================================

const DISTILL_THRESHOLD = 3

const DISTILL_SYSTEM_PROMPT = `あなたは「AI Partner」という機能の学習コーチです。
ユーザーから集まった「👍 良かった応答」と「違う と指摘された応答 → 望んだ応答」のペアを読み、
次回の Partner 応答生成に使う **蒸留された学び** を1つのブロックにまとめてください。

## 重要な原則
- **NGパターンは抽象化する**: 具体的な文言を列挙するのではなく、失敗の構造・型として一般化する
  - 悪い例: 「『5分だけ筋トレしてみては』と言わない」
  - 良い例: 「本人が日記で既に決めている行動に対して『やってみては』と提案を返すな。既に決まっている場面では承認か静かな観察で終える」
- **良い例は原典を残す**: 具体的な応答が教訓になるものは、2〜3個だけそのまま引用する
- **グループ化**: 似た失敗は1つのルールにまとめる。10個の具体例を3つの抽象ルールに凝縮する
- **冗長を避ける**: 全体で400字以内を目標に。過去のフィードバックを羅列するのではなく、そこから何を学んだかを書く
- **局所最適に偏らない**: 「最近は休息モードばかり指摘された」としても、挑戦モードへの応答も同等に考慮する。一方向に偏ったアドバイスを書かない

## 出力フォーマット（Markdown）

### NG: 避けるべきパターン
（抽象化した失敗の型を3〜5個。各1〜2行）

### OK: 本人が良しとした応答の型
（抽象化した成功パターンを2〜3個 + 原典引用を1〜2個）

### 補足（任意・あれば）
（特定の言い回し禁止など、個別ルール）

テキストのみ、400字以内。`

/** Distill all active raw feedback into an LLM-curated lesson block. */
export async function distillLessons(): Promise<DistilledLesson | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: feedback, error } = await supabase
    .from('ai_partner_feedback')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error || !feedback || feedback.length === 0) return null

  const rows = feedback as PartnerFeedback[]
  const goods = rows.filter((r) => r.feedback_type === 'good')
  const corrs = rows.filter((r) => r.feedback_type === 'correction')

  // Build the corpus the LLM will distill
  const corpusParts: string[] = []
  if (goods.length > 0) {
    corpusParts.push(
      '## 👍 良かった応答\n' +
        goods.map((g, i) => {
          const ctx = summarizeContext(g.context_snapshot)
          return `${i + 1}. [${ctx}] ${g.actual_output}`
        }).join('\n'),
    )
  }
  if (corrs.length > 0) {
    corpusParts.push(
      '## 違う と指摘された応答\n' +
        corrs.map((c, i) => {
          const ctx = summarizeContext(c.context_snapshot)
          const parts = [
            `${i + 1}. [${ctx}]`,
            `  NG: ${c.actual_output}`,
            `  望まれた応答: ${c.desired_output ?? '(未記入)'}`,
          ]
          if (c.reason) parts.push(`  理由: ${c.reason}`)
          if (c.category) parts.push(`  カテゴリ: ${c.category}`)
          return parts.join('\n')
        }).join('\n\n'),
    )
  }

  const corpus = corpusParts.join('\n\n')
  if (!corpus.trim()) return null

  try {
    const { content } = await aiCompletion(corpus, {
      source: 'ai_partner_distillation',
      systemPrompt: DISTILL_SYSTEM_PROMPT,
      model: 'gpt-5.4-mini',
      maxTokens: 1000,
      temperature: 0.3,
    })
    const distilled = content?.trim()
    if (!distilled) return null

    // Deactivate previous distillations (we only keep 1 active)
    await supabase
      .from('ai_partner_distilled_lessons')
      .update({ active: false })
      .eq('active', true)

    const { data: inserted, error: insertErr } = await supabase
      .from('ai_partner_distilled_lessons')
      .insert({
        user_id: user.id,
        content: distilled,
        source_feedback_ids: rows.map((r) => r.id),
        source_count: rows.length,
        model_used: 'gpt-5.4-mini',
        active: true,
      })
      .select()
      .single()
    if (insertErr || !inserted) {
      console.error('[partnerFeedback] distill insert failed', insertErr)
      return null
    }
    return inserted as DistilledLesson
  } catch (e) {
    console.error('[partnerFeedback] distillation failed', e)
    return null
  }
}

/**
 * Fire-and-forget background distillation triggered from feedback inserts.
 * Runs only if enough new feedback has accumulated since the last distillation
 * (avoids burning API calls on every single feedback click).
 */
async function maybeDistillInBackground(): Promise<void> {
  try {
    const latest = await fetchLatestDistilledLesson()
    const { count } = await supabase
      .from('ai_partner_feedback')
      .select('*', { count: 'exact', head: true })
      .eq('active', true)
      .gt('created_at', latest?.created_at ?? '1970-01-01')
    const newSince = count ?? 0
    if (newSince >= DISTILL_THRESHOLD) {
      // Fire and forget — don't block the UI
      distillLessons().catch((e) => console.error('[distill bg] failed', e))
    }
  } catch (e) {
    console.error('[distill bg check] failed', e)
  }
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
