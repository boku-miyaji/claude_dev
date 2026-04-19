import { supabase } from '@/lib/supabase'

/**
 * Append-only revision history for diary_entries (design-philosophy ⑩ / ③).
 *
 * Call `snapshotDiaryRevision()` BEFORE running any update on diary_entries.
 * The current live row is copied into `diary_entry_revisions` so the edit
 * history is never lost. This is the load-bearing piece of the "過去を書き
 * 換えない" philosophy — the live row can mutate, the history cannot.
 *
 * Design choices:
 * - Snapshot captures only user-authored + derived analytic fields (body,
 *   emotions, wbi, topics, tags, ai_summary). Image URLs and embeddings are
 *   regenerated downstream and add little historical value.
 * - `change_reason` is free-text so the UI can tag edits ("typo fix",
 *   "感情ラベルの修正", "AI解釈への反論" etc.).
 * - Failure to snapshot MUST NOT block the update. Log and continue; a
 *   missing revision is strictly better than a lost edit.
 */
export async function snapshotDiaryRevision(
  diaryEntryId: number,
  changeReason?: string,
): Promise<void> {
  try {
    const { data: current, error } = await supabase
      .from('diary_entries')
      .select('id, body, emotions, wbi, topics, tags, ai_summary')
      .eq('id', diaryEntryId)
      .single()
    if (error || !current) {
      console.warn('[diaryRevisions] could not fetch current row, skipping snapshot', error)
      return
    }
    const { error: insertErr } = await supabase
      .from('diary_entry_revisions')
      .insert({
        diary_entry_id: current.id,
        body: current.body,
        emotions: current.emotions,
        wbi: current.wbi,
        topics: current.topics,
        tags: current.tags,
        ai_summary: current.ai_summary,
        change_reason: changeReason ?? null,
      })
    if (insertErr) {
      console.warn('[diaryRevisions] snapshot insert failed', insertErr)
    }
  } catch (e) {
    console.warn('[diaryRevisions] unexpected error during snapshot', e)
  }
}

/** Fetch full revision history of a diary entry, newest first. */
export async function fetchDiaryRevisions(diaryEntryId: number) {
  const { data, error } = await supabase
    .from('diary_entry_revisions')
    .select('*')
    .eq('diary_entry_id', diaryEntryId)
    .order('snapshot_taken_at', { ascending: false })
  if (error) {
    console.error('[diaryRevisions] fetch failed', error)
    return []
  }
  return data ?? []
}
