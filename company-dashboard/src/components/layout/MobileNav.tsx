import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

interface MobileNavItem {
  page: string
  icon: string
  label: string
}

const MAIN_TABS: MobileNavItem[] = [
  { page: '', icon: '◉', label: 'Home' },
  { page: 'tasks', icon: '☐', label: 'Tasks' },
  { page: 'chat', icon: '💬', label: 'AI' },
]

const MORE_ITEMS: { label: string; items: MobileNavItem[] }[] = [
  {
    label: 'Core',
    items: [
      { page: 'dreams', icon: '🌟', label: 'Dreams' },
      { page: 'habits', icon: '🌱', label: 'Habits' },
      { page: 'insights', icon: '📊', label: 'Insights' },
      { page: 'intelligence', icon: '📄', label: 'Reports' },
    ],
  },
  {
    label: 'Work',
    items: [
      { page: 'finance', icon: '¥', label: 'Finance' },
      { page: 'calendar', icon: '📅', label: 'Calendar' },
      { page: 'companies', icon: '◫', label: 'Org' },
      { page: 'knowledge', icon: '◈', label: 'Knowledge' },
    ],
  },
  {
    label: 'More',
    items: [
      { page: 'artifacts', icon: '📄', label: 'Artifacts' },
      { page: 'growth', icon: '↗', label: 'Growth' },
      { page: 'settings', icon: '⚙', label: 'Settings' },
      { page: 'how-it-works', icon: '?', label: 'Guide' },
    ],
  },
]

export function MobileNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const [showMore, setShowMore] = useState(false)
  const currentPage = location.pathname.replace('/', '') || ''

  const goTo = (page: string) => {
    navigate(`/${page}`)
    setShowMore(false)
  }

  return (
    <>
      {/* Full menu overlay */}
      {showMore && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.3)',
            backdropFilter: 'blur(4px)',
            zIndex: 99,
          }}
          onClick={() => setShowMore(false)}
        />
      )}
      {showMore && (
        <div style={{
          position: 'fixed',
          bottom: 60,
          left: 0,
          right: 0,
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          borderRadius: '16px 16px 0 0',
          zIndex: 100,
          padding: '16px 20px 20px',
          maxHeight: '60vh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-lg)',
        }}>
          {MORE_ITEMS.map((group) => (
            <div key={group.label} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--text3)', marginBottom: 8 }}>
                {group.label}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {group.items.map((item) => (
                  <button
                    key={item.page}
                    onClick={() => goTo(item.page)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      padding: '10px 4px',
                      background: currentPage === item.page ? 'var(--accent-bg)' : 'none',
                      border: 'none',
                      borderRadius: 'var(--r)',
                      cursor: 'pointer',
                      fontSize: 10,
                      color: currentPage === item.page ? 'var(--accent2)' : 'var(--text2)',
                      fontFamily: 'var(--font)',
                      fontWeight: 500,
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom nav bar */}
      <nav className="mobile-nav">
        <div className="mobile-nav-inner">
          {MAIN_TABS.map((tab) => (
            <button
              key={tab.page}
              className={`mob-nav-item${currentPage === tab.page ? ' active' : ''}`}
              onClick={() => goTo(tab.page)}
            >
              <span className="mob-icon">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
          <button
            className={`mob-nav-item${showMore ? ' active' : ''}`}
            onClick={() => setShowMore(!showMore)}
          >
            <span className="mob-icon">&#8943;</span>
            More
          </button>
        </div>
      </nav>
    </>
  )
}
