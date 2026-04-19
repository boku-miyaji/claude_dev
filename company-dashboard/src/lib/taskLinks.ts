import { supabase } from '@/lib/supabase'
import type { Task, TaskCalendarLink } from '@/types/tasks'

/**
 * Task ↔ Calendar event linking.
 *
 * Tasks (何をやるか / 成果物 / 締切) and calendar events (= time blocks,
 * いつ作業するか) are independently editable. A task can be associated
 * with 0 or N blocks, and a block can host 0 or N tasks.
 *
 * For recurring events, links are stored against the specific instance id
 * Google Calendar returns for each occurrence. The master event id is also
 * stored (when available) so the UI can choose to display a link on every
 * instance of the series.
 */

export interface LinkedTaskRow extends TaskCalendarLink {
  tasks: Task | null
}

/** All tasks linked to a specific event (by instance id). */
export async function fetchTasksForEvent(eventId: string): Promise<LinkedTaskRow[]> {
  const { data, error } = await supabase
    .from('task_calendar_links')
    .select('*, tasks(*, companies(name))')
    .or(`calendar_event_id.eq.${eventId},recurring_event_id.eq.${eventId}`)
    .order('created_at')
  if (error) {
    console.error('[taskLinks] fetchTasksForEvent failed:', error)
    return []
  }
  return (data as LinkedTaskRow[]) || []
}

/** All calendar links for a single task. */
export async function fetchLinksForTask(taskId: string | number): Promise<TaskCalendarLink[]> {
  const { data, error } = await supabase
    .from('task_calendar_links')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at')
  if (error) {
    console.error('[taskLinks] fetchLinksForTask failed:', error)
    return []
  }
  return (data as TaskCalendarLink[]) || []
}

/** Fetch links for many tasks in one round-trip. */
export async function fetchLinksForTasks(taskIds: Array<string | number>): Promise<Map<string, TaskCalendarLink[]>> {
  const map = new Map<string, TaskCalendarLink[]>()
  if (taskIds.length === 0) return map
  const { data, error } = await supabase
    .from('task_calendar_links')
    .select('*')
    .in('task_id', taskIds)
  if (error || !data) return map
  for (const row of data as TaskCalendarLink[]) {
    const key = String(row.task_id)
    const list = map.get(key) || []
    list.push(row)
    map.set(key, list)
  }
  return map
}

export interface LinkEventOptions {
  /** Master recurring event id, if this event is an instance of a series. */
  recurringEventId?: string | null
  /** Optional audit: progress this block is expected to move. */
  progressContribution?: number | null
  note?: string | null
}

/** Link a task to a calendar event. Idempotent on (task_id, calendar_event_id). */
export async function linkTaskToEvent(
  taskId: string | number,
  eventId: string,
  calendarId: string,
  opts: LinkEventOptions = {},
): Promise<TaskCalendarLink | null> {
  const { data, error } = await supabase
    .from('task_calendar_links')
    .upsert(
      {
        task_id: typeof taskId === 'string' ? parseInt(taskId, 10) : taskId,
        calendar_event_id: eventId,
        calendar_id: calendarId,
        recurring_event_id: opts.recurringEventId ?? null,
        progress_contribution: opts.progressContribution ?? null,
        note: opts.note ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'task_id,calendar_event_id' },
    )
    .select()
    .single()
  if (error) {
    console.error('[taskLinks] linkTaskToEvent failed:', error)
    return null
  }
  return data as TaskCalendarLink
}

/** Remove the link between a task and an event. */
export async function unlinkTaskFromEvent(taskId: string | number, eventId: string): Promise<boolean> {
  const { error } = await supabase
    .from('task_calendar_links')
    .delete()
    .eq('task_id', taskId)
    .eq('calendar_event_id', eventId)
  if (error) {
    console.error('[taskLinks] unlinkTaskFromEvent failed:', error)
    return false
  }
  return true
}

/** Update just the progress percentage of a task. */
export async function updateTaskProgress(taskId: string | number, pct: number | null): Promise<boolean> {
  const clamped = pct == null ? null : Math.max(0, Math.min(100, Math.round(pct)))
  const { error } = await supabase
    .from('tasks')
    .update({ progress_pct: clamped })
    .eq('id', taskId)
  if (error) {
    console.error('[taskLinks] updateTaskProgress failed:', error)
    return false
  }
  return true
}
