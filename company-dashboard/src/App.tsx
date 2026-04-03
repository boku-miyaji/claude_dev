import { Routes, Route } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/stores/auth'
import { Sidebar } from '@/components/layout/Sidebar'
import { LegacyPage } from '@/components/legacy/LegacyPage'
import { AuthPage } from '@/pages/AuthPage'
import {
  renderDashboard, renderCalendar, renderTasks, renderCompanies,
  renderOrgChart, renderFinance, renderInsights, renderPrompts,
  renderIntelligence, renderDiary, renderArtifacts, renderChat,
  renderApiCosts, renderGrowth, renderHowItWorks, renderSlashCommands,
  renderSettings, renderCareer, renderKnowledge, renderPortfolio,
} from '@/lib/legacy'

export function App() {
  useAuth()
  const { loading, appReady, user } = useAuthStore()

  // loading中 or ユーザーはいるがappReady待ち → ローディング表示（AuthPageを見せない）
  if (loading || (user && !appReady)) {
    return (
      <div className="auth-page">
        <div className="auth-box">
          <div className="auth-logo">M</div>
          <h1>宮路HD</h1>
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
          <Route path="/" element={<LegacyPage renderer={renderDashboard} />} />
          <Route path="/calendar" element={<LegacyPage renderer={renderCalendar} />} />
          <Route path="/tasks" element={<LegacyPage renderer={renderTasks} />} />
          <Route path="/companies" element={<LegacyPage renderer={renderCompanies} />} />
          <Route path="/orgchart" element={<LegacyPage renderer={renderOrgChart} />} />
          <Route path="/finance" element={<LegacyPage renderer={renderFinance} />} />
          <Route path="/insights" element={<LegacyPage renderer={renderInsights} />} />
          <Route path="/prompts" element={<LegacyPage renderer={renderPrompts} />} />
          <Route path="/intelligence" element={<LegacyPage renderer={renderIntelligence} />} />
          <Route path="/diary" element={<LegacyPage renderer={renderDiary} />} />
          <Route path="/artifacts/*" element={<LegacyPage renderer={renderArtifacts} />} />
          <Route path="/chat/*" element={<LegacyPage renderer={renderChat} />} />
          <Route path="/api-costs" element={<LegacyPage renderer={renderApiCosts} />} />
          <Route path="/growth" element={<LegacyPage renderer={renderGrowth} />} />
          <Route path="/how-it-works" element={<LegacyPage renderer={renderHowItWorks} />} />
          <Route path="/commands" element={<LegacyPage renderer={renderSlashCommands} />} />
          <Route path="/settings" element={<LegacyPage renderer={renderSettings} />} />
          <Route path="/career" element={<LegacyPage renderer={renderCareer} />} />
          <Route path="/knowledge" element={<LegacyPage renderer={renderKnowledge} />} />
          <Route path="/portfolio" element={<LegacyPage renderer={renderPortfolio} />} />
        </Routes>
      </div>
      <div className="toast" id="toast" />
      <div id="modal-root" />
    </div>
  )
}
