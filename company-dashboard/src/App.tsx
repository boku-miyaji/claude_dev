import { Routes, Route } from 'react-router-dom'

export function App() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'var(--font)' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>宮路HD</h1>
        <p style={{ color: 'var(--text2)', fontSize: 14 }}>React migration in progress...</p>
        <Routes>
          <Route path="/" element={<p style={{ marginTop: 16, color: 'var(--text3)', fontSize: 12 }}>Phase 0: Scaffolding complete</p>} />
        </Routes>
      </div>
    </div>
  )
}
