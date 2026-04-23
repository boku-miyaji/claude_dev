/**
 * Types for intelligence_suggestions — 情報収集部が出す示唆を追跡するテーブル
 *
 * フロー: new → checked → adopted/rejected → implemented
 *        [別ルート] new → dismissed
 *
 * 設計: /workspace/.company/departments/ai-dev/design/intelligence-suggestions-schema.md
 */

export type SuggestionStatus =
  | 'new'
  | 'checked'
  | 'adopted'
  | 'rejected'
  | 'implemented'
  | 'dismissed'

export type SuggestionPriority = 'high' | 'medium' | 'low'
export type SuggestionEffort = 'small' | 'medium' | 'large'

/** Category is open-ended in the schema, but we hint at common values for UX. */
export type SuggestionCategory =
  | 'algorithm'
  | 'architecture'
  | 'ux'
  | 'cost'
  | 'competition'
  | 'design'
  | 'other'
  | string

export type SuggestionTarget = 'focus-you' | 'hd-ops' | 'both'

export interface IntelligenceSuggestion {
  id: string
  title: string
  description: string | null
  priority: SuggestionPriority | null
  effort: SuggestionEffort | null
  category: SuggestionCategory | null
  target: SuggestionTarget
  source_report_path: string | null
  source_report_date: string | null
  source_urls: string[]
  status: SuggestionStatus
  task_id: number | null
  checked_at: string | null
  adopted_at: string | null
  rejected_at: string | null
  implemented_at: string | null
  dismissed_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Mapping from suggestion.priority to tasks.priority. tasks.priority
 * supports 'high' | 'normal' | 'low'. Suggestion "high" escalates to task
 * priority "high"; "medium" maps to "normal".
 */
export const PRIORITY_TO_TASK_PRIORITY: Record<SuggestionPriority, 'high' | 'normal' | 'low'> = {
  high: 'high',
  medium: 'normal',
  low: 'low',
}
