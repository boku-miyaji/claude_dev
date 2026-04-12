import { useEffect, useState } from 'react'
import { Card, PageHeader, toast } from '@/components/ui'
import { supabase } from '@/lib/supabase'

// ============================================================
// Types
// ============================================================

interface UserSettings {
  user_id: string
  ingest_api_key?: string
  chat_nickname?: string
  chat_occupation?: string
  chat_about?: string
  chat_style?: string
  chat_warmth?: string
  chat_emoji?: string
  chat_custom_instructions?: string
  chat_memory_enabled?: boolean
  chat_diary_enabled?: boolean
  [key: string]: unknown
}

interface ClaudeSettings {
  scope: string
  server_host?: string
  server_path?: string
  plugins?: Record<string, boolean>
  permissions?: { allow?: string[] }
  skills?: unknown
  mcp_servers?: Record<string, { command?: string; args?: unknown; tools?: unknown; scope?: string }>
  claude_md_content?: string
  updated_at?: string
}

// ============================================================
// Sub-components
// ============================================================

function PersonalizationSection({ settings, userId }: { settings: UserSettings | null; userId: string }) {
  const [form, setForm] = useState({
    chat_nickname: settings?.chat_nickname || '',
    chat_occupation: settings?.chat_occupation || '',
    chat_about: settings?.chat_about || '',
    chat_style: settings?.chat_style || 'default',
    chat_warmth: settings?.chat_warmth || 'default',
    chat_emoji: settings?.chat_emoji || 'default',
    chat_custom_instructions: settings?.chat_custom_instructions || '',
    chat_memory_enabled: settings?.chat_memory_enabled !== false,
    chat_diary_enabled: settings?.chat_diary_enabled !== false,
  })

  const update = (key: string, val: string | boolean) => setForm((f) => ({ ...f, [key]: val }))

  const save = async () => {
    await supabase.from('user_settings').update(form).eq('user_id', userId)
    toast('Personalization saved!')
  }

  return (
    <>
      <div className="section-title">Personalization</div>
      <Card style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
          AI Chat があなたのことを理解するための設定。
        </p>

        <Field label="Nickname" value={form.chat_nickname} onChange={(v) => update('chat_nickname', v)} placeholder="How should AI call you?" />
        <Field label="Occupation" value={form.chat_occupation} onChange={(v) => update('chat_occupation', v)} placeholder="e.g. AI Developer, Freelance Consultant" />
        <Field label="About You" value={form.chat_about} onChange={(v) => update('chat_about', v)} placeholder="Interests, values..." textarea />
        <SelectField label="Response Style" value={form.chat_style} onChange={(v) => update('chat_style', v)}
          options={[['default', 'Default'], ['formal', 'Formal'], ['casual', 'Casual'], ['concise', 'Concise'], ['detailed', 'Detailed']]} />
        <SelectField label="Warmth" value={form.chat_warmth} onChange={(v) => update('chat_warmth', v)}
          options={[['default', 'Default'], ['warm', 'Warm'], ['neutral', 'Neutral'], ['direct', 'Direct']]} />
        <SelectField label="Emoji" value={form.chat_emoji} onChange={(v) => update('chat_emoji', v)}
          options={[['default', 'Default'], ['none', 'None'], ['some', 'Some'], ['lots', 'Lots']]} />

        <div style={{ display: 'flex', gap: 24, marginBottom: 14 }}>
          <Toggle label="Use Knowledge & Insights" checked={form.chat_memory_enabled} onChange={(v) => update('chat_memory_enabled', v)} />
          <Toggle label="Use Diary for Context" checked={form.chat_diary_enabled} onChange={(v) => update('chat_diary_enabled', v)} />
        </div>

        <Field label="Custom Instructions" value={form.chat_custom_instructions} onChange={(v) => update('chat_custom_instructions', v)} placeholder="Additional behavior, style..." textarea />

        <button className="btn btn-primary" onClick={save}>Save Personalization</button>
      </Card>
    </>
  )
}

function ApiKeysSection({ settings, userId }: { settings: UserSettings | null; userId: string }) {
  const [key, setKey] = useState(settings?.ingest_api_key || '')
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

  const save = async () => {
    if (!key.trim()) return
    await supabase.from('user_settings').update({ ingest_api_key: key.trim() }).eq('user_id', userId)
    toast('Ingest Key saved')
  }

  const copyEnv = () => {
    const env = `SUPABASE_URL="${supabaseUrl}"\nSUPABASE_ANON_KEY="${supabaseAnonKey}"\nSUPABASE_INGEST_KEY="${key.trim()}"\nSUPABASE_ACCESS_TOKEN="<YOUR_TOKEN_HERE>"`
    navigator.clipboard.writeText(env).then(() => toast('supabase.env copied'))
  }

  return (
    <>
      <div className="section-title">API Keys & Hook Config</div>
      <Card style={{ marginBottom: 24 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Ingest API Key</div>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
          Hook / intelligence collect が Supabase に書き込むための認証キー。
        </p>
        <input className="input" value={key} onChange={(e) => setKey(e.target.value)}
          placeholder="Ingest API Key (UUID)" style={{ fontFamily: 'var(--mono)', fontSize: 12, marginBottom: 8 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setKey(crypto.randomUUID())}>UUID 生成</button>
          <button className="btn btn-primary btn-sm" onClick={save}>保存</button>
          <button className="btn btn-ghost btn-sm" onClick={copyEnv}>supabase.env コピー</button>
        </div>
      </Card>
    </>
  )
}

function ClaudeCodeSection({ settings }: { settings: ClaudeSettings[] }) {
  if (settings.length === 0) return (
    <Card><div className="empty">まだ設定が同期されていません。ターミナルで /company を実行すると自動同期されます。</div></Card>
  )

  const allPlugins: { name: string; enabled: boolean; scope: string }[] = []
  const allPermissions: { rule: string; scope: string }[] = []
  const allSkills: { name: string; scope: string; detail?: string }[] = []
  const allMcp: { name: string; command?: string; toolCount: number; scope: string }[] = []
  const scopes: { scope: string; host: string; path: string; updated?: string }[] = []

  for (const s of settings) {
    const hostName = s.scope?.includes(':') ? s.scope.split(':')[0] : ''
    const dirPath = s.scope?.includes(':') ? s.scope.split(':').slice(1).join(':') : s.server_path || ''
    scopes.push({ scope: s.scope, host: s.server_host || hostName, path: dirPath, updated: s.updated_at })

    if (s.plugins) for (const [p, enabled] of Object.entries(s.plugins)) allPlugins.push({ name: p, enabled, scope: s.scope })
    if (s.permissions?.allow) for (const r of s.permissions.allow) allPermissions.push({ rule: r, scope: s.scope })
    if (s.skills) {
      const sk = s.skills
      if (Array.isArray(sk)) for (const item of sk) allSkills.push(typeof item === 'string' ? { name: item, scope: s.scope } : { ...item, scope: s.scope })
      else for (const [name, detail] of Object.entries(sk as Record<string, string>)) allSkills.push({ name, scope: s.scope, detail })
    }
    if (s.mcp_servers) for (const [m, info] of Object.entries(s.mcp_servers)) {
      const tools = info.tools ? (Array.isArray(info.tools) ? info.tools.length : Object.keys(info.tools).length) : 0
      allMcp.push({ name: m, command: info.command, toolCount: tools, scope: s.scope })
    }
  }

  const permGroups: Record<string, { rule: string; scope: string }[]> = {}
  for (const p of allPermissions) {
    const type = p.rule.split('(')[0] || 'Other'
    if (!permGroups[type]) permGroups[type] = []
    permGroups[type].push(p)
  }

  return (
    <>
      <div className="gradient-line" />
      <div className="section-title">Claude Code Settings</div>

      <div className="section-title">Scopes ({scopes.length})</div>
      <div className="g3" style={{ marginBottom: 20 }}>
        {scopes.map((sc) => (
          <Card key={sc.scope}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              {sc.host && <><span style={{ fontWeight: 600, fontSize: 14 }}>{sc.host}</span><span style={{ fontSize: 8, color: '#22c55e' }}>●</span></>}
            </div>
            <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>{sc.path || sc.scope}</div>
            {sc.updated && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 8 }}>Synced: {new Date(sc.updated).toLocaleString('ja-JP')}</div>}
          </Card>
        ))}
      </div>

      {allPlugins.length > 0 && (
        <>
          <div className="section-title">Plugins ({allPlugins.length})</div>
          <Card style={{ marginBottom: 20 }}>
            {allPlugins.sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span className={`dot ${p.enabled ? 'dot-active' : 'dot-archived'}`} />
                <span style={{ flex: 1, fontWeight: 500 }}>{p.name}</span>
                <span className="tag tag-co">{p.scope}</span>
              </div>
            ))}
          </Card>
        </>
      )}

      {allSkills.length > 0 && (
        <>
          <div className="section-title">Skills ({allSkills.length})</div>
          <Card style={{ marginBottom: 20 }}>
            {allSkills.map((sk, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span style={{ fontSize: 15, opacity: 0.6 }}>⚡</span>
                <span style={{ flex: 1 }}>
                  <span style={{ fontWeight: 500 }}>{sk.name}</span>
                  {sk.detail && <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 8 }}>{sk.detail}</span>}
                </span>
                <span className="tag tag-co">{sk.scope}</span>
              </div>
            ))}
          </Card>
        </>
      )}

      {allMcp.length > 0 && (
        <>
          <div className="section-title">MCP Servers ({allMcp.length})</div>
          <Card style={{ marginBottom: 20 }}>
            {allMcp.sort((a, b) => a.name.localeCompare(b.name)).map((m) => (
              <div key={m.name} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                  <span style={{ fontSize: 15, opacity: 0.6 }}>🔌</span>
                  <span style={{ flex: 1, fontWeight: 500 }}>{m.name}</span>
                  {m.toolCount > 0 && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{m.toolCount} tools</span>}
                  <span className="tag tag-co">{m.scope}</span>
                </div>
                {m.command && <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)', margin: '6px 0 0 30px' }}>{m.command}</div>}
              </div>
            ))}
          </Card>
        </>
      )}

      {Object.keys(permGroups).length > 0 && (
        <>
          <div className="section-title">Permissions ({allPermissions.length})</div>
          <Card style={{ maxHeight: 400, overflowY: 'auto', marginBottom: 20 }}>
            {Object.entries(permGroups).sort(([a], [b]) => a.localeCompare(b)).map(([type, perms]) => (
              <div key={type}>
                <div style={{ fontSize: 11, color: 'var(--accent2)', margin: '12px 0 6px', fontWeight: 600 }}>{type} ({perms.length})</div>
                {perms.map((p, i) => {
                  const detail = p.rule.includes('(') ? p.rule.substring(p.rule.indexOf('(') + 1, p.rule.lastIndexOf(')')) : p.rule
                  return (
                    <div key={i} style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)', padding: '2px 0 2px 12px', display: 'flex', gap: 8 }}>
                      <span style={{ flex: 1, wordBreak: 'break-all' }}>{detail}</span>
                      <span className="tag tag-co" style={{ flexShrink: 0 }}>{p.scope}</span>
                    </div>
                  )
                })}
              </div>
            ))}
          </Card>
        </>
      )}
    </>
  )
}

// ============================================================
// Shared UI helpers
// ============================================================

function Field({ label, value, onChange, placeholder, textarea }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; textarea?: boolean
}) {
  const Tag = textarea ? 'textarea' : 'input'
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{label}</div>
      <Tag className="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ fontSize: 13, ...(textarea ? { minHeight: 60, resize: 'vertical' as const } : {}) }} />
    </div>
  )
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[][]
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{label}</div>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)} style={{ fontSize: 13 }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 18, height: 18 }} />
      {label}
    </label>
  )
}

// ============================================================
// Main Page
// ============================================================

export function Settings() {
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null)
  const [claudeSettings, setClaudeSettings] = useState<ClaudeSettings[]>([])
  const [userId, setUserId] = useState('')
  const [isCliMode, setIsCliMode] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setUserId(session.user.id)

      const [usRes, csRes] = await Promise.all([
        supabase.from('user_settings').select('*').eq('user_id', session.user.id).single(),
        supabase.from('claude_settings').select('*').order('scope'),
      ])
      setUserSettings(usRes.data)
      setClaudeSettings(csRes.data || [])
      setIsCliMode((csRes.data || []).length > 0)
      setLoading(false)
    })()
  }, [])

  if (loading) return <div className="page"><PageHeader title="Settings" /><div className="skeleton-card" style={{ height: 200 }} /></div>

  return (
    <div className="page">
      <PageHeader title="Settings" description="ユーザー設定" />
      <PersonalizationSection settings={userSettings} userId={userId} />
      <ApiKeysSection settings={userSettings} userId={userId} />
      {isCliMode && <ClaudeCodeSection settings={claudeSettings} />}
    </div>
  )
}
