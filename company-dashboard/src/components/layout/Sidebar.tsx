import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { useCompanyStore } from '@/stores/company'
import { supabase } from '@/lib/supabase'

interface NavEntry {
  type: 'item' | 'label'
  page?: string
  icon?: string
  label: string
}

const NAV: NavEntry[] = [
  { type: 'item', page: '', icon: '◉', label: 'Home' },
  { type: 'item', page: 'calendar', icon: '📅', label: 'Calendar' },
  { type: 'label', label: 'Management' },
  { type: 'item', page: 'tasks', icon: '☐', label: 'Tasks' },
  { type: 'item', page: 'companies', icon: '◫', label: 'Companies' },
  { type: 'item', page: 'finance', icon: '¥', label: 'Finance' },
  { type: 'label', label: 'Analytics' },
  { type: 'item', page: 'insights', icon: '◇', label: 'Insights' },
  { type: 'item', page: 'prompts', icon: '▷', label: 'Prompts' },
  { type: 'item', page: 'intelligence', icon: '📄', label: 'Reports' },
  { type: 'item', page: 'api-costs', icon: '$', label: 'API Costs' },
  { type: 'item', page: 'growth', icon: '↗', label: 'Growth' },
  { type: 'label', label: 'Personal' },
  { type: 'item', page: 'career', icon: '☆', label: 'Career' },
  { type: 'item', page: 'diary', icon: '✎', label: 'Diary' },
  { type: 'label', label: 'Tools' },
  { type: 'item', page: 'knowledge', icon: '◈', label: 'Knowledge' },
  { type: 'item', page: 'artifacts', icon: '📄', label: 'Artifacts' },
  { type: 'item', page: 'chat', icon: '💬', label: 'AI Chat' },
  { type: 'item', page: 'commands', icon: '⌘', label: 'Commands' },
]

export function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuthStore()
  const { companies, activeCompanyId, setCompanies, setActiveCompany } = useCompanyStore()

  const currentPage = location.pathname.replace('/', '') || ''

  useEffect(() => {
    supabase.from('companies').select('id,name').eq('status', 'active').order('created_at').then(({ data }) => {
      if (data) setCompanies(data)
    })
  }, [setCompanies])

  return (
    <nav className="sidebar">
      <div className="logo">
        <div className="logo-icon">M</div>
        宮路HD
      </div>

      {/* Company context switcher */}
      <div style={{ padding: '0 12px', marginBottom: 12 }}>
        <select
          className="input"
          style={{ width: '100%', fontSize: 12, padding: '6px 8px' }}
          value={activeCompanyId || ''}
          onChange={(e) => setActiveCompany(e.target.value || null)}
        >
          <option value="">全社（HD）</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {NAV.map((entry, i) =>
        entry.type === 'label' ? (
          <div key={i} className="nav-group-label">{entry.label}</div>
        ) : (
          <button
            key={entry.page}
            className={`nav-item${currentPage === entry.page ? ' active' : ''}`}
            onClick={() => navigate(`/${entry.page}`)}
          >
            <span className="nav-icon">{entry.icon}</span> {entry.label}
          </button>
        ),
      )}

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
