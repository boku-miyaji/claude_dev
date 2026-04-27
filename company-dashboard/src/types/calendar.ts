export type ViewMode = 'day' | 'week' | 'month'
// Edge Function は primary calendar かそれ以外かの 2値だけ返す。
// 業務/個人の細分類はハードコード（旧: acesinc 等）を避け、UI 側で色は
// Google calendarList の backgroundColor を優先利用する。
export type CalendarType = 'primary' | 'secondary'

export interface CalendarEvent {
  id: string
  calendar_id: string
  calendar_type: CalendarType
  summary: string
  start_time: string
  end_time: string
  all_day: boolean
  status?: string
  response_status?: string | null
  location?: string | null
  hangoutLink?: string | null
  description?: string | null
}

export interface GcalCalendar {
  id: string
  label: string
  type: CalendarType
}
