export interface NavItem {
  page: string
  icon: string
  label: string
  group?: string
  pinned?: boolean
}

export type TaskStatus = 'open' | 'in_progress' | 'done'
export type Priority = 'high' | 'normal' | 'low'
