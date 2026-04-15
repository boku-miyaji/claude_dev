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
  attachments?: AttachmentMeta[] | null
  /** Joined field from tasks query with companies */
  companies?: { name: string } | null
}
