export type DreamCategory =
  | 'career'
  | 'travel'
  | 'skill'
  | 'health'
  | 'relationship'
  | 'creative'
  | 'financial'
  | 'experience'
  | 'other'

export type DreamStatus = 'active' | 'in_progress' | 'achieved' | 'paused'

export interface Dream {
  id: string
  title: string
  description: string | null
  category: string
  status: DreamStatus
  achieved_at: string | null
  priority: number
  created_at: string
  updated_at: string
  owner_id: string
}

export const DREAM_CATEGORIES: { value: DreamCategory; label: string; icon: string }[] = [
  { value: 'career', label: 'キャリア', icon: '🎯' },
  { value: 'travel', label: '旅行', icon: '✈️' },
  { value: 'skill', label: 'スキル', icon: '📚' },
  { value: 'health', label: '健康', icon: '💪' },
  { value: 'relationship', label: '人間関係', icon: '❤️' },
  { value: 'creative', label: 'クリエイティブ', icon: '🎨' },
  { value: 'financial', label: '資産', icon: '💰' },
  { value: 'experience', label: '体験', icon: '🌟' },
  { value: 'other', label: 'その他', icon: '✨' },
]

export const DREAM_STATUSES: { value: DreamStatus; label: string }[] = [
  { value: 'active', label: '未着手' },
  { value: 'in_progress', label: '進行中' },
  { value: 'achieved', label: '達成' },
  { value: 'paused', label: '一時停止' },
]
