import { ALL_SHORTCUTS, type Shortcut } from '@/lib/shortcuts'

interface Props {
  onClose: () => void
}

const SCOPE_LABELS: Record<string, string> = {
  global: 'Global',
  chat: 'AI Chat',
  today: 'Today',
  calendar: 'Calendar',
}

export function ShortcutHelp({ onClose }: Props) {
  const grouped = new Map<string, Shortcut[]>()
  for (const s of ALL_SHORTCUTS) {
    const list = grouped.get(s.scope) || []
    list.push(s)
    grouped.set(s.scope, list)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg)', borderRadius: 12, padding: '24px 28px',
          maxWidth: 520, width: '90vw', maxHeight: '80vh', overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Keyboard Shortcuts</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text3)' }}>
            &times;
          </button>
        </div>

        {Array.from(grouped.entries()).map(([scope, shortcuts]) => (
          <div key={scope} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              {SCOPE_LABELS[scope] || scope}
            </div>
            {shortcuts.map((s) => (
              <div key={s.label + s.description} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>{s.description}</span>
                <kbd style={{
                  fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text)',
                  background: 'var(--bg2)', border: '1px solid var(--border)',
                  borderRadius: 5, padding: '2px 7px', whiteSpace: 'nowrap',
                }}>{s.label}</kbd>
              </div>
            ))}
          </div>
        ))}

        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8, textAlign: 'center' }}>
          Press <kbd style={{ fontSize: 10, fontFamily: 'var(--mono)', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px' }}>Cmd+/</kbd> to toggle
        </div>
      </div>
    </div>
  )
}
