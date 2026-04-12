import { useEffect } from 'react'

export interface DeptTeam { name: string; role: string }

export interface DeptDetail {
  id: string
  name: string
  icon: string
  role: string
  longDescription: string
  model: 'opus' | 'sonnet' | 'haiku'
  teams: DeptTeam[]
  skills: string[]
  triggers: string[]
  inputs: string[]
  outputs: string[]
  rules: string[]
  pipelines: string[]
}

interface ActivityItem {
  action: string
  created_at: string
  summary?: string
}

interface Props {
  dept: DeptDetail | null
  recentActivity: ActivityItem[]
  onClose: () => void
}

export function DepartmentDetailModal({ dept, recentActivity, onClose }: Props) {
  useEffect(() => {
    if (!dept) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [dept, onClose])

  if (!dept) return null

  const modelBadgeColor: Record<string, { bg: string; fg: string }> = {
    opus: { bg: 'rgba(124, 58, 237, 0.12)', fg: '#7c3aed' },
    sonnet: { bg: 'rgba(37, 99, 235, 0.12)', fg: '#2563eb' },
    haiku: { bg: 'rgba(22, 163, 74, 0.12)', fg: '#16a34a' },
  }
  const badge = modelBadgeColor[dept.model] || modelBadgeColor.sonnet

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(3px)',
        zIndex: 1000,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '60px 20px 40px',
        overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.25)',
          maxWidth: 760,
          width: '100%',
          padding: '28px 32px 32px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 'var(--r)',
            background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, color: 'var(--accent2)', flexShrink: 0,
          }}>
            {dept.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.02em' }}>{dept.name}</span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                background: badge.bg, color: badge.fg, textTransform: 'uppercase', letterSpacing: '.06em',
                fontFamily: 'var(--mono)',
              }}>
                {dept.model}
              </span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.65 }}>
              {dept.longDescription}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent', border: 'none', color: 'var(--text3)',
              cursor: 'pointer', fontSize: 18, padding: 4, lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Teams */}
        {dept.teams.length > 0 && (
          <Section label="チーム構成">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
              {dept.teams.map((t) => (
                <div key={t.name} style={{
                  padding: '10px 12px',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.55 }}>{t.role}</div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Skills */}
        {dept.skills.length > 0 && (
          <Section label="スキル・専門領域">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {dept.skills.map((s) => (
                <span key={s} style={{
                  fontSize: 11, padding: '4px 10px',
                  background: 'var(--accent-bg)', color: 'var(--accent2)',
                  borderRadius: 4, border: '1px solid var(--accent-border)',
                }}>
                  {s}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Triggers */}
        {dept.triggers.length > 0 && (
          <Section label="どういう指示で呼ばれるか">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {dept.triggers.map((t) => (
                <span key={t} style={{
                  fontSize: 11, fontFamily: 'var(--mono)', padding: '3px 8px',
                  background: 'var(--surface2)', borderRadius: 4, color: 'var(--text2)',
                  border: '1px solid var(--border)',
                }}>
                  {t}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Inputs / Outputs */}
        {(dept.inputs.length > 0 || dept.outputs.length > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 }}>
            {dept.inputs.length > 0 && (
              <Section label="入力" noMargin>
                <ul style={listStyle}>{dept.inputs.map((i) => <li key={i} style={liStyle}>{i}</li>)}</ul>
              </Section>
            )}
            {dept.outputs.length > 0 && (
              <Section label="出力" noMargin>
                <ul style={listStyle}>{dept.outputs.map((o) => <li key={o} style={liStyle}>{o}</li>)}</ul>
              </Section>
            )}
          </div>
        )}

        {/* Rules */}
        {dept.rules.length > 0 && (
          <Section label="主要ルール">
            <ul style={listStyle}>{dept.rules.map((r) => <li key={r} style={liStyle}>{r}</li>)}</ul>
          </Section>
        )}

        {/* Pipelines */}
        {dept.pipelines.length > 0 && (
          <Section label="登場するパイプライン">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {dept.pipelines.map((p) => (
                <span key={p} style={{
                  fontSize: 11, padding: '3px 10px',
                  background: 'var(--green-bg)', color: 'var(--green)',
                  border: '1px solid var(--green-border)', borderRadius: 4,
                }}>
                  {p}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Recent activity */}
        <Section label="最近の稼働">
          {recentActivity.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recentActivity.slice(0, 5).map((a, i) => (
                <div key={i} style={{
                  fontSize: 11, color: 'var(--text2)',
                  padding: '6px 10px',
                  background: 'var(--surface2)',
                  borderRadius: 4,
                  display: 'flex', justifyContent: 'space-between', gap: 10,
                }}>
                  <span>{a.summary || a.action}</span>
                  <span style={{ color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 10, flexShrink: 0 }}>
                    {new Date(a.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>
              最近の稼働記録はありません
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}

function Section({ label, children, noMargin }: { label: string; children: React.ReactNode; noMargin?: boolean }) {
  return (
    <div style={{ marginTop: noMargin ? 0 : 20 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '.08em', color: 'var(--text3)', marginBottom: 8,
      }}>
        {label}
      </div>
      {children}
    </div>
  )
}

const listStyle: React.CSSProperties = { margin: 0, padding: '0 0 0 18px', fontSize: 12, color: 'var(--text2)', lineHeight: 1.75 }
const liStyle: React.CSSProperties = { marginBottom: 2 }
