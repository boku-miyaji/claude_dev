/**
 * Handlers for intelligence_suggestions table.
 *
 * ステータス遷移:
 *   new → checked (→ tasks に INSERT、task_id を保存)
 *   new → dismissed
 *   checked → adopted | rejected
 *   adopted → implemented
 *
 * 設計: /workspace/.company/departments/ai-dev/design/intelligence-suggestions-schema.md
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultSupabase } from '@/lib/supabase'
import {
  PRIORITY_TO_TASK_PRIORITY,
  type IntelligenceSuggestion,
  type SuggestionPriority,
} from '@/types/intelligence'

/**
 * SupabaseClient を差し替え可能にして、テストでモックしやすくする。
 * 通常利用時は `@/lib/supabase` の default インスタンスを使う。
 */
type Client = Pick<SupabaseClient, 'from'>

/** Mark a suggestion as dismissed (not interested / skip entirely). */
export async function dismissSuggestion(id: string, client: Client = defaultSupabase): Promise<void> {
  const { error } = await client
    .from('intelligence_suggestions')
    .update({ status: 'dismissed', dismissed_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/** Mark a checked suggestion as adopted (we will implement this). */
export async function adoptSuggestion(id: string, client: Client = defaultSupabase): Promise<void> {
  const { error } = await client
    .from('intelligence_suggestions')
    .update({ status: 'adopted', adopted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/** Mark a checked suggestion as rejected (considered but not adopted). */
export async function rejectSuggestion(id: string, client: Client = defaultSupabase): Promise<void> {
  const { error } = await client
    .from('intelligence_suggestions')
    .update({ status: 'rejected', rejected_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/** Mark an adopted suggestion as implemented (completed). */
export async function markImplemented(id: string, client: Client = defaultSupabase): Promise<void> {
  const { error } = await client
    .from('intelligence_suggestions')
    .update({ status: 'implemented', implemented_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/**
 * "Check" a suggestion — the key handler.
 *
 * 1. 対象の suggestion を取得
 * 2. `tasks` に対応する task を INSERT (type=request, tags=[from-intelligence, insight, category])
 * 3. `intelligence_suggestions` を UPDATE (status=checked, task_id=newTaskId, checked_at=now)
 *
 * 失敗時: task INSERT に失敗したら UPDATE しない（task_id が宙に浮かないように）
 */
export async function checkSuggestion(id: string, client: Client = defaultSupabase): Promise<number> {
  // 1. fetch the suggestion
  const { data: sug, error: fetchErr } = await client
    .from('intelligence_suggestions')
    .select('*')
    .eq('id', id)
    .single()
  if (fetchErr) throw fetchErr
  if (!sug) throw new Error(`Suggestion not found: ${id}`)

  const suggestion = sug as IntelligenceSuggestion

  // 2. build task payload
  const title = `[insight] ${suggestion.title}`
  const descParts: string[] = []
  if (suggestion.description) descParts.push(suggestion.description)
  if (suggestion.source_report_path) descParts.push(`Source: ${suggestion.source_report_path}`)
  if (suggestion.source_urls && suggestion.source_urls.length > 0) {
    descParts.push(`URLs: ${suggestion.source_urls.join(', ')}`)
  }
  const description = descParts.join('\n\n')

  const taskPriority = suggestion.priority
    ? PRIORITY_TO_TASK_PRIORITY[suggestion.priority as SuggestionPriority]
    : 'normal'

  const tags = ['from-intelligence', 'insight', suggestion.category || 'other']

  // 3. INSERT task
  const { data: task, error: insertErr } = await client
    .from('tasks')
    .insert({
      title,
      description,
      type: 'request',
      status: 'open',
      priority: taskPriority,
      tags,
    })
    .select('id')
    .single()
  if (insertErr) throw insertErr
  if (!task) throw new Error('Failed to create task (no row returned)')

  const taskId = (task as { id: number }).id

  // 4. UPDATE suggestion
  const { error: updateErr } = await client
    .from('intelligence_suggestions')
    .update({
      status: 'checked',
      task_id: taskId,
      checked_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (updateErr) throw updateErr

  return taskId
}
