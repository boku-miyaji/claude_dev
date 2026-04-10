import { useEffect, useState } from 'react'
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
  { type: 'item', page: '', icon: '◉', label: 'Home' },
  { type: 'item', page: 'chat', icon: '💬', label: 'AI Chat' },
  { type: 'item', page: 'tasks', icon: '☐', label: 'Tasks' },
  // Plan & Track
  { type: 'label', label: 'Plan' },
  { type: 'item', page: 'dreams', icon: '🌟', label: 'Dreams & Goals' },
  { type: 'item', page: 'habits', icon: '🌱', label: 'Habits' },
  { type: 'item', page: 'calendar', icon: '📅', label: 'Calendar' },
  { type: 'item', page: 'finance', icon: '¥', label: 'Finance' },
  // Understand
  { type: 'label', label: 'Understand' },
  { type: 'item', page: 'journal', icon: '📔', label: 'Journal' },
  { type: 'item', page: 'insights', icon: '📊', label: 'Insights' },
  { type: 'item', page: 'me', icon: '🧬', label: 'Self-Analysis' },
  { type: 'item', page: 'intelligence', icon: '📄', label: 'News' },
  { type: 'item', page: 'growth', icon: '↗', label: 'Growth' },
  // Data
  { type: 'label', label: 'Data' },
  { type: 'item', page: 'companies', icon: '◫', label: 'Organization' },
  { type: 'item', page: 'knowledge', icon: '◈', label: 'Knowledge' },
  { type: 'item', page: 'artifacts', icon: '📄', label: 'Artifacts' },
  { type: 'item', page: 'prompts', icon: '▷', label: 'Prompts' },
  { type: 'item', page: 'commands', icon: '⌘', label: 'Commands' },
  { type: 'item', page: 'blueprint', icon: '◇', label: 'Blueprint' },
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
  const isChat = currentPage.startsWith('chat')

  // Auto-hide main sidebar on chat page (chat has its own sidebar)
  const [manualHidden, setManualHidden] = useState(false)
  const sidebarHidden = isChat || manualHidden
  const setSidebarHidden = setManualHidden

  // Listen for Cmd+Shift+S shortcut
  useEffect(() => {
    const handler = () => setSidebarHidden((v) => !v)
    window.addEventListener('shortcut:toggle-sidebar', handler)
    return () => window.removeEventListener('shortcut:toggle-sidebar', handler)
  }, [])

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
    <>
    {sidebarHidden && !isChat && (
      <button
        className="sidebar-toggle"
        onClick={() => setSidebarHidden(false)}
        title="メニューを開く"
      >
        &#9776;
      </button>
    )}
    <nav className={`sidebar${sidebarHidden ? ' collapsed' : ''}`}>
      <div className="logo" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/icon.svg" alt="Focus You" width={28} height={28} style={{ borderRadius: 7 }} />
          Focus You
        </div>
        <button
          onClick={() => setSidebarHidden(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text3)', padding: '2px 6px', borderRadius: 4 }}
          title="メニューを閉じる"
        >
          &#x2715;
        </button>
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

      <div className="nav-user">
        {user ? `@${user.user_metadata?.user_name || user.email || ''}` : ''}
      </div>
      <button className="nav-item" onClick={signOut}>
        <span className="nav-icon">→</span> Sign out
      </button>
    </nav>
    </>
  )
}
