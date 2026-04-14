import type { GcalCalendar } from '@/types/calendar'
import type { NavItem } from '@/types/common'

export const GCAL_CLIENT_ID = '855851839827-hfijpvgal6m3hgrjgus6bdf8it8ibr9h.apps.googleusercontent.com'
export const GCAL_SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/tasks'

export const GCAL_CALENDARS: GcalCalendar[] = [
  { id: 'yumzzz.my6223@gmail.com', label: 'yumzzz.my6223', type: 'primary' },
  { id: 'yuta.miyaji.xyz@gmail.com', label: 'yuta.miyaji.xyz', type: 'secondary' },
  { id: 'yuta.miyaji@acesinc.co.jp', label: 'yuta.miyaji@acesinc.co.jp', type: 'work' },
]

export const NAV_ITEMS: NavItem[] = [
  { page: 'calendar', icon: '\uD83D\uDCC5', label: 'Calendar', group: 'Pages' },
  { page: 'finance', icon: '\u00A5', label: 'Finance', group: 'Management' },
  { page: 'tasks', icon: '\u2610', label: 'Tasks', group: 'Management' },
  { page: 'companies', icon: '\u25EB', label: 'Co.', group: 'Management' },
  { page: 'career', icon: '\u2606', label: 'Career', group: 'Analytics' },
  { page: 'orgchart', icon: '\u229E', label: 'Org', group: 'Management' },
  { page: 'insights', icon: '\u25C7', label: 'Insights', group: 'Analytics' },
  { page: 'prompts', icon: '\u25B7', label: 'Prompts', group: 'Analytics' },
  { page: 'intelligence', icon: '\uD83D\uDCE1', label: 'News', group: 'Analytics' },
  { page: 'knowledge', icon: '\u25C8', label: 'Knowledge', group: 'Analytics' },
  { page: 'diary', icon: '\u270E', label: 'Diary', group: 'Personal', pinned: true },
  { page: 'artifacts', icon: '\uD83D\uDCC4', label: 'Artifacts', group: 'Personal', pinned: true },
  { page: 'growth', icon: '\u2197', label: 'Growth', group: 'Analytics' },
  { page: 'api-costs', icon: '$', label: 'Costs', group: 'Tools' },
  { page: 'commands', icon: '\u2318', label: 'Commands', group: 'Tools' },
  { page: 'settings', icon: '\u2699', label: 'Settings', group: 'Tools' },
]
