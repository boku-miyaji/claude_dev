export type HabitCategory = 'life' | 'work' | 'health' | 'learning' | 'mindfulness'
export type HabitFrequency = 'daily' | 'weekly' | 'monthly'

export interface Habit {
  id: number
  title: string
  description: string | null
  category: HabitCategory
  frequency: HabitFrequency
  target_count: number
  icon: string
  active: boolean
  created_at: string
  owner_id?: string
}

export interface HabitLog {
  id: number
  habit_id: number
  completed_at: string
  note: string | null
  owner_id?: string
}

export const HABIT_CATEGORIES: { value: HabitCategory; label: string; icon: string }[] = [
  { value: 'life', label: '生活', icon: '🏠' },
  { value: 'work', label: '仕事', icon: '💼' },
  { value: 'health', label: '健康', icon: '💪' },
  { value: 'learning', label: '学習', icon: '📚' },
  { value: 'mindfulness', label: '心', icon: '🧘' },
]

export const HABIT_ICONS = ['✅', '🏃', '📖', '💧', '🧘', '✍️', '🎯', '💪', '🌅', '😴']
