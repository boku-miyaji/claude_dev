import { Routes, Route } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/stores/auth'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileNav } from '@/components/layout/MobileNav'
import { LegacyPage } from '@/components/legacy/LegacyPage'
import { AuthPage } from '@/pages/AuthPage'
import {
  renderDashboard, renderCalendar,
  renderOrgChart, renderFinance, renderInsights, renderPrompts,
  renderDiary, renderArtifacts, renderChat,
  renderApiCosts, renderGrowth,
  renderSettings, renderCareer, renderPortfolio,
} from '@/lib/legacy'
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
import { GoogleAuthCallback } from '@/pages/GoogleAuthCallback'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { ShortcutHelp } from '@/components/ShortcutHelp'

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
          <Route path="/dashboard-legacy" element={<LegacyPage renderer={renderDashboard} />} />
          <Route path="/calendar" element={<LegacyPage renderer={renderCalendar} />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/companies" element={<Companies />} />
          <Route path="/orgchart" element={<LegacyPage renderer={renderOrgChart} />} />
          <Route path="/finance" element={<LegacyPage renderer={renderFinance} />} />
          <Route path="/insights" element={<LegacyPage renderer={renderInsights} />} />
          <Route path="/prompts" element={<LegacyPage renderer={renderPrompts} />} />
          <Route path="/intelligence" element={<Reports />} />
          <Route path="/news" element={<Reports />} />
          <Route path="/diary" element={<LegacyPage renderer={renderDiary} />} />
          <Route path="/artifacts/*" element={<LegacyPage renderer={renderArtifacts} />} />
          <Route path="/chat/*" element={<LegacyPage renderer={renderChat} />} />
          <Route path="/api-costs" element={<LegacyPage renderer={renderApiCosts} />} />
          <Route path="/growth" element={<LegacyPage renderer={renderGrowth} />} />
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
  )
}
