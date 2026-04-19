import { supabase } from '@/lib/supabase'

/**
 * Append-only archive for story_memory (design-philosophy ③).
 *
 * Before any UPDATE on story_memory, snapshot the current row into
 * story_memory_archive. The live row keeps only the latest narrative;
 * the archive keeps the full history so past interpretations (Arc,
 * Theme, Identity, Aspirations, Chapter) are never lost and can be
 * reviewed later.
 *
 * All writes are fire-and-forget from the caller's perspective: a
 * failed archive MUST NOT block the update itself. Losing an archive
 * entry is strictly better than blocking the Narrator from refreshing.
 */
export async function archiveStoryMemoryByType(
  memoryType: string,
  reason?: string,
): Promise<void> {
  try {
    const { data: current, error } = await supabase
      .from('story_memory')
      .select('id, memory_type, content, narrative_text, version, created_at, updated_at')
      .eq('memory_type', memoryType)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error || !current) return
    const { error: insertErr } = await supabase
      .from('story_memory_archive')
      .insert({
        original_id: current.id,
        memory_type: current.memory_type,
        content: current.content,
        narrative_text: current.narrative_text,
        version: current.version,
        original_created_at: current.created_at,
        original_updated_at: current.updated_at,
        archive_reason: reason ?? null,
      })
    if (insertErr) {
      console.warn('[storyMemoryArchive] insert failed', insertErr)
    }
  } catch (e) {
    console.warn('[storyMemoryArchive] unexpected error', e)
  }
}

/** Same but archives a specific row by id (used when multiple rows share a memory_type). */
export async function archiveStoryMemoryById(
  id: number,
  reason?: string,
): Promise<void> {
  try {
    const { data: current } = await supabase
      .from('story_memory')
      .select('id, memory_type, content, narrative_text, version, created_at, updated_at')
      .eq('id', id)
      .maybeSingle()
    if (!current) return
    await supabase.from('story_memory_archive').insert({
      original_id: current.id,
      memory_type: current.memory_type,
      content: current.content,
      narrative_text: current.narrative_text,
      version: current.version,
      original_created_at: current.created_at,
      original_updated_at: current.updated_at,
      archive_reason: reason ?? null,
    })
  } catch (e) {
    console.warn('[storyMemoryArchive] unexpected error', e)
  }
}

/** Fetch full archive history for a memory_type, newest first. */
export async function fetchStoryMemoryArchive(memoryType: string, limit = 20) {
  const { data, error } = await supabase
    .from('story_memory_archive')
    .select('*')
    .eq('memory_type', memoryType)
    .order('archived_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('[storyMemoryArchive] fetch failed', error)
    return []
  }
  return data ?? []
}
