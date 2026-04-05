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
  completed_at: string | null
  created_at: string
  tags: string[]
  sort_order: number
  source: string | null
  /** Joined field from tasks query with companies */
  companies?: { name: string } | null
}
