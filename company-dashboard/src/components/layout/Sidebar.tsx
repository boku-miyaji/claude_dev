import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'

interface NavEntry {
  type: 'item' | 'label' | 'collapsible-start'
  page?: string
  icon?: string
  label: string
  groupKey?: string
  cli?: boolean // true = CLI専用（Claude Code依存）
}

// Product tabs: diary中心、一般ユーザー向け
const PRODUCT_NAV: NavEntry[] = [
  { type: 'item', page: '', icon: '◉', label: 'Home' },
  { type: 'item', page: 'journal', icon: '📔', label: 'Journal' },
  // Plan
  { type: 'label', label: 'Plan' },
  { type: 'item', page: 'dreams', icon: '🌟', label: 'Dreams & Goals' },
  { type: 'item', page: 'habits', icon: '🌱', label: 'Habits' },
  { type: 'item', page: 'calendar', icon: '📅', label: 'Calendar' },
  { type: 'item', page: 'manual', icon: '📘', label: 'Manual' },
  // Know Yourself
  { type: 'label', label: 'Know Yourself' },
  { type: 'item', page: 'story', icon: '📖', label: 'Story' },
  { type: 'item', page: 'roots', icon: '🕰', label: 'Roots' },
  { type: 'item', page: 'insights', icon: '📊', label: 'Patterns' },
  { type: 'item', page: 'me', icon: '🧬', label: 'Frameworks' },
]

// CLI-only tabs: Claude Code 依存
const CLI_NAV: NavEntry[] = [
  { type: 'label', label: 'Claude Code' },
  { type: 'item', page: 'intelligence', icon: '📰', label: 'News', cli: true },
  { type: 'item', page: 'growth', icon: '↗', label: 'Growth', cli: true },
  { type: 'item', page: 'companies', icon: '◫', label: 'Organization', cli: true },
  { type: 'item', page: 'finance', icon: '¥', label: 'Finance', cli: true },
  { type: 'item', page: 'prompts', icon: '▷', label: 'Prompts', cli: true },
  { type: 'item', page: 'knowledge', icon: '◈', label: 'Knowledge', cli: true },
  { type: 'item', page: 'artifacts', icon: '📄', label: 'Artifacts', cli: true },
  { type: 'item', page: 'api-costs', icon: '$', label: 'API Costs', cli: true },
  { type: 'item', page: 'career', icon: '☆', label: 'Career', cli: true },
  { type: 'item', page: 'requests', icon: '↗', label: 'Requests', cli: true },
  { type: 'item', page: 'commands', icon: '⌘', label: 'Commands', cli: true },
  { type: 'item', page: 'blueprint', icon: '◇', label: 'Blueprint', cli: true },
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
  const [isCliMode, setIsCliMode] = useState(false)
  const currentPage = location.pathname.replace('/', '') || ''

  // CLI mode detection: claude_settings にデータがあればCLIタブを表示
  useEffect(() => {
    supabase.from('claude_settings').select('id').limit(1).then(({ data }) => {
      setIsCliMode(Boolean(data && data.length > 0))
    })
  }, [])

  const [manualHidden, setManualHidden] = useState(false)
  const sidebarHidden = manualHidden
  const setSidebarHidden = setManualHidden

  // Listen for Cmd+Shift+S shortcut
  useEffect(() => {
    const handler = () => setSidebarHidden((v) => !v)
    window.addEventListener('shortcut:toggle-sidebar', handler)
    return () => window.removeEventListener('shortcut:toggle-sidebar', handler)
  }, [])

  const NAV = isCliMode ? [...PRODUCT_NAV, ...CLI_NAV] : PRODUCT_NAV
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
    {sidebarHidden && (
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
        className={`nav-item${currentPage === 'profile' ? ' active' : ''}`}
        onClick={() => navigate('/profile')}
      >
        <span className="nav-icon">👤</span> 基本情報
      </button>
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
