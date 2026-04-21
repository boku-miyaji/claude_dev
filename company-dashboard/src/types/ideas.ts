export type IdeaStatus = 'raw' | 'review' | 'adopted' | 'rejected'

export interface Idea {
  id: string
  owner_id: string
  content: string
  status: IdeaStatus
  tags: string[]
  created_at: string
  updated_at: string
}

export const IDEA_STATUSES: { value: IdeaStatus; label: string; hint: string }[] = [
  { value: 'raw', label: 'raw', hint: '書き捨て' },
  { value: 'review', label: '検討中', hint: '育て中' },
  { value: 'adopted', label: '採用', hint: '実行へ' },
  { value: 'rejected', label: '却下', hint: 'ログ残し' },
]
