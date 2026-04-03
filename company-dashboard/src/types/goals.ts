export interface Goal {
  id: string
  title: string
  description: string | null
  level: GoalLevel
  parent_id: string | null
  dream_id: string | null
  status: GoalStatus
  progress: number
  target_date: string | null
  achieved_at: string | null
  created_at: string
  updated_at: string
  owner_id: string
}

export type GoalLevel = 'life' | 'yearly' | 'quarterly' | 'monthly' | 'weekly'
export type GoalStatus = 'active' | 'achieved' | 'paused' | 'dropped'

export const GOAL_LEVELS: { value: GoalLevel; label: string; icon: string }[] = [
  { value: 'life', label: '人生', icon: '🌟' },
  { value: 'yearly', label: '年間', icon: '📅' },
  { value: 'quarterly', label: '四半期', icon: '📊' },
  { value: 'monthly', label: '月間', icon: '📋' },
  { value: 'weekly', label: '週間', icon: '✅' },
]

export const GOAL_STATUSES: { value: GoalStatus; label: string }[] = [
  { value: 'active', label: '進行中' },
  { value: 'achieved', label: '達成' },
  { value: 'paused', label: '一時停止' },
  { value: 'dropped', label: '中止' },
]
