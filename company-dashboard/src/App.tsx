import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/stores/auth'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileNav } from '@/components/layout/MobileNav'
import { LegacyPage } from '@/components/legacy/LegacyPage'
import { AuthPage } from '@/pages/AuthPage'
import {
  renderDashboard, renderCalendar,
  renderOrgChart, renderFinance, renderPrompts,
  renderArtifacts, renderChat,
  renderApiCosts,
  renderSettings, renderCareer, renderPortfolio,
} from '@/lib/legacy'
import { Insights } from '@/pages/Insights'
import { Growth } from '@/pages/Growth'
import { Blueprint } from '@/pages/Blueprint'
import { SlashCommands } from '@/pages/SlashCommands'
import { Knowledge } from '@/pages/Knowledge'
import { Tasks } from '@/pages/Tasks'
import { Companies } from '@/pages/Companies'
import { Reports } from '@/pages/Reports'
import { Today } from '@/pages/Today'
import { Journal } from '@/pages/Journal'
import { Dreams } from '@/pages/Dreams'
import { SelfAnalysis } from '@/pages/SelfAnalysis'
import { Goals } from '@/pages/Goals'
import { Habits } from '@/pages/Habits'
import { WeeklyNarrative } from '@/pages/WeeklyNarrative'
import { Story } from '@/pages/Story'
import { GoogleAuthCallback } from '@/pages/GoogleAuthCallback'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { ShortcutHelp } from '@/components/ShortcutHelp'
import { Component, type ReactNode, type ErrorInfo } from 'react'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error.message, info.componentStack)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', background: '#1a1a2e', color: '#ff6b6b', minHeight: '100vh' }}>
          <h2 style={{ color: '#fff', marginBottom: 12 }}>Focus You — Runtime Error</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6 }}>{this.state.error.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, color: '#888', marginTop: 16 }}>{this.state.error.stack}</pre>
          <button onClick={() => { this.setState({ error: null }); window.location.reload() }} style={{ marginTop: 20, padding: '8px 16px', background: '#5046e5', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Reload</button>
        </div>
      )
    }
    return this.props.children
  }
}

export function App() {
  useAuth()
  const { loading, appReady, user } = useAuthStore()
  const { showHelp, setShowHelp } = useKeyboardShortcuts()

  // loading中 or ユーザーはいるがappReady待ち → ローディング表示（AuthPageを見せない）
  if (loading || (user && !appReady)) {
    return (
      <div className="auth-page">
        <div className="auth-box">
          <img src="/icon.svg" alt="Focus You" width={56} height={56} style={{ borderRadius: 14 }} />
          <h1>Focus You</h1>
          <p style={{ color: 'var(--text3)' }}>Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <AuthPage />
  }

  return (
    <ErrorBoundary>
    <div className="app">
      <Sidebar />
      <div className="main">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/dreams" element={<Dreams />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/me" element={<SelfAnalysis />} />
          <Route path="/habits" element={<Habits />} />
          <Route path="/weekly" element={<WeeklyNarrative />} />
          <Route path="/story" element={<Story />} />
          <Route path="/dashboard-legacy" element={<LegacyPage renderer={renderDashboard} />} />
          <Route path="/calendar" element={<LegacyPage renderer={renderCalendar} />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/companies" element={<Companies />} />
          <Route path="/orgchart" element={<LegacyPage renderer={renderOrgChart} />} />
          <Route path="/finance" element={<LegacyPage renderer={renderFinance} />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/prompts" element={<LegacyPage renderer={renderPrompts} />} />
          <Route path="/intelligence" element={<Reports />} />
          <Route path="/news" element={<Reports />} />
          <Route path="/diary" element={<Navigate to="/journal" replace />} />
          <Route path="/artifacts/*" element={<LegacyPage renderer={renderArtifacts} />} />
          <Route path="/chat/*" element={<LegacyPage renderer={renderChat} />} />
          <Route path="/api-costs" element={<LegacyPage renderer={renderApiCosts} />} />
          <Route path="/growth" element={<Growth />} />
          <Route path="/blueprint" element={<Blueprint />} />
          <Route path="/commands" element={<SlashCommands />} />
          <Route path="/settings" element={<LegacyPage renderer={renderSettings} />} />
          <Route path="/career" element={<LegacyPage renderer={renderCareer} />} />
          <Route path="/knowledge" element={<Knowledge />} />
          <Route path="/portfolio" element={<LegacyPage renderer={renderPortfolio} />} />
          <Route path="/auth/google/callback" element={<GoogleAuthCallback />} />
        </Routes>
      </div>
      <MobileNav />
      <div className="toast" id="toast" />
      <div id="modal-root" />
      {showHelp && <ShortcutHelp onClose={() => setShowHelp(false)} />}
    </div>
    </ErrorBoundary>
  )
}
