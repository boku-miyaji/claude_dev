import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'

interface NavEntry {
  type: 'item' | 'label' | 'collapsible-start'
  page?: string
  icon?: string
  label: string
  groupKey?: string
}

const NAV: NavEntry[] = [
  // Main (always visible)
  { type: 'item', page: '', icon: '◉', label: 'Today' },
  { type: 'item', page: 'journal', icon: '📔', label: 'Journal' },
  { type: 'item', page: 'dreams', icon: '🌟', label: 'Dreams' },
  { type: 'item', page: 'chat', icon: '💬', label: 'AI Chat' },
  // Self
  { type: 'label', label: 'Self' },
  { type: 'item', page: 'goals', icon: '🎯', label: 'Goals' },
  { type: 'item', page: 'habits', icon: '🌱', label: 'Habits' },
  { type: 'item', page: 'me', icon: '🧠', label: 'Me' },
  { type: 'item', page: 'career', icon: '☆', label: 'Career' },
  // Work (collapsible)
  { type: 'collapsible-start', label: 'Work', groupKey: 'work' },
  { type: 'item', page: 'tasks', icon: '☐', label: 'Tasks' },
  { type: 'item', page: 'companies', icon: '◫', label: 'Companies' },
  { type: 'item', page: 'finance', icon: '¥', label: 'Finance' },
  { type: 'item', page: 'calendar', icon: '📅', label: 'Calendar' },
  // Intelligence (collapsible)
  { type: 'collapsible-start', label: 'Intelligence', groupKey: 'intel' },
  { type: 'item', page: 'weekly', icon: '📖', label: 'Weekly' },
  { type: 'item', page: 'insights', icon: '◇', label: 'Insights' },
  { type: 'item', page: 'intelligence', icon: '📄', label: 'Reports' },
  { type: 'item', page: 'growth', icon: '↗', label: 'Growth' },
  // Workspace (collapsible)
  { type: 'collapsible-start', label: 'Workspace', groupKey: 'workspace' },
  { type: 'item', page: 'knowledge', icon: '◈', label: 'Knowledge' },
  { type: 'item', page: 'artifacts', icon: '📄', label: 'Artifacts' },
  { type: 'item', page: 'prompts', icon: '▷', label: 'Prompts' },
  { type: 'item', page: 'commands', icon: '⌘', label: 'Commands' },
]

/** Group NAV entries into sections for collapsible rendering */
function buildSections(nav: NavEntry[]) {
  const sections: { type: 'label' | 'collapsible'; label: string; groupKey?: string; items: NavEntry[] }[] = []
  let currentItems: NavEntry[] = []

  for (const entry of nav) {
    if (entry.type === 'label') {
      if (currentItems.length > 0) {
        sections.push({ type: 'label', label: '', items: currentItems })
        currentItems = []
      }
      sections.push({ type: 'label', label: entry.label, items: [] })
    } else if (entry.type === 'collapsible-start') {
      if (currentItems.length > 0) {
        sections.push({ type: 'label', label: '', items: currentItems })
        currentItems = []
      }
      sections.push({ type: 'collapsible', label: entry.label, groupKey: entry.groupKey, items: [] })
    } else {
      // Add to current collapsible/label section or top-level
      if (sections.length > 0 && sections[sections.length - 1].items !== undefined) {
        sections[sections.length - 1].items.push(entry)
      } else {
        currentItems.push(entry)
      }
    }
  }
  if (currentItems.length > 0) {
    sections.push({ type: 'label', label: '', items: currentItems })
  }
  return sections
}

export function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuthStore()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const currentPage = location.pathname.replace('/', '') || ''

  const sections = buildSections(NAV)

  const toggleGroup = (key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const renderItem = (entry: NavEntry) => (
    <button
      key={entry.page}
      className={`nav-item${currentPage === entry.page ? ' active' : ''}`}
      onClick={() => navigate(`/${entry.page}`)}
    >
      <span className="nav-icon">{entry.icon}</span> {entry.label}
    </button>
  )

  return (
    <nav className="sidebar">
      <div className="logo">
        <div className="logo-icon">M</div>
        宮路HD
      </div>

      {sections.map((section, si) => {
        if (section.type === 'collapsible' && section.groupKey) {
          const isCollapsed = collapsed[section.groupKey] ?? false
          return (
            <div key={si}>
              <button
                className="nav-group-label"
                onClick={() => toggleGroup(section.groupKey!)}
                style={{
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                  width: '100%',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontFamily: 'var(--font)',
                  fontSize: 9,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '.12em',
                  color: 'var(--text3)',
                  padding: '16px 20px 6px',
                  opacity: 0.7,
                }}
              >
                {section.label}
                <span style={{ fontSize: 10, opacity: 0.6, transition: 'transform .2s', transform: isCollapsed ? 'rotate(-90deg)' : 'none' }}>
                  ▾
                </span>
              </button>
              {!isCollapsed && section.items.map(renderItem)}
            </div>
          )
        }

        return (
          <div key={si}>
            {section.label && <div className="nav-group-label">{section.label}</div>}
            {section.items.map(renderItem)}
          </div>
        )
      })}

      <div className="nav-spacer" />
      <button
        className={`nav-item${currentPage === 'settings' ? ' active' : ''}`}
        onClick={() => navigate('/settings')}
      >
        <span className="nav-icon">⚙</span> Settings
      </button>
      <button
        className={`nav-item${currentPage === 'how-it-works' ? ' active' : ''}`}
        onClick={() => navigate('/how-it-works')}
      >
        <span className="nav-icon">?</span> How it Works
      </button>

      <div className="nav-user">
        {user ? `@${user.user_metadata?.user_name || user.email || ''}` : ''}
      </div>
      <button className="nav-item" onClick={signOut}>
        <span className="nav-icon">→</span> Sign out
      </button>
    </nav>
  )
}
