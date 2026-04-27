export type ViewMode = 'day' | 'week' | 'month'
export type CalendarType = 'primary' | 'secondary' | 'work'

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
