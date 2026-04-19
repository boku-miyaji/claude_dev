export type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'anytime'

export interface AttachmentMeta {
  path: string
  type: string
  size: number
  name: string
}

export interface Task {
  id: string
  title: string
  description: string | null
  company_id: string | null
  department_id: string | null
  type: string | null
  priority: 'high' | 'normal' | 'low'
  status: 'open' | 'in_progress' | 'done' | 'cancelled'
  due_date: string | null
  scheduled_at: string | null
  deadline_at: string | null
  estimated_minutes: number | null
  time_slot: TimeSlot | null
  google_task_id: string | null
  completed_at: string | null
  created_at: string
  tags: string[]
  sort_order: number
  source: string | null
  /** Progress (0-100). null = not tracked. */
  progress_pct: number | null
  attachments?: AttachmentMeta[] | null
  /** Joined field from tasks query with companies */
  companies?: { name: string } | null
}

/**
 * Link between a task and a Google Calendar event (= time block).
 * N:N — one block can hold multiple tasks; one task can span multiple blocks.
 */
export interface TaskCalendarLink {
  id: number
  task_id: number
  calendar_event_id: string
  calendar_id: string
  /** If the event is an instance of a recurring event, the master event id. */
  recurring_event_id: string | null
  /** Optional audit: how much this block contributed to the task progress. */
  progress_contribution: number | null
  note: string | null
  created_at: string
  updated_at: string
}
