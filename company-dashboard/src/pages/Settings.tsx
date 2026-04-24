import { useEffect, useState } from 'react'
import { Card, PageHeader, toast } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { PartnerFeedbackSettings } from '@/components/PartnerFeedbackSettings'

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
  chat_user_label?: string
  chat_tone_mode?: 'auto' | 'soft' | 'bold'
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
    chat_custom_instructions: settings?.chat_custom_instructions || '',
    chat_memory_enabled: settings?.chat_memory_enabled !== false,
    chat_diary_enabled: settings?.chat_diary_enabled !== false,
    chat_user_label: settings?.chat_user_label || '',
    chat_tone_mode: (settings?.chat_tone_mode as 'auto' | 'soft' | 'bold') || 'auto',
  })

  const update = (key: string, val: string | boolean) => setForm((f) => ({ ...f, [key]: val }))

  const save = async () => {
    await supabase.from('user_settings').update(form).eq('user_id', userId)
    toast('設定を保存しました')
  }

  return (
    <>
      <div className="section-title">AIチャット設定</div>
      <Card style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
          AIチャットがあなたを理解し、自然に話しかけるための設定です。
        </p>

        <Field label="呼び方" value={form.chat_user_label} onChange={(v) => update('chat_user_label', v)} placeholder="例: ゆうた、ゆうたさん、先輩 など。空欄なら呼びません" />
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: -8, marginBottom: 14 }}>
          AIがあなたに語りかけるときの呼称。空欄にすると呼ばず、自然な語りかけになります。
        </div>

        <SelectField label="基本トーン" value={form.chat_tone_mode} onChange={(v) => update('chat_tone_mode', v)}
          options={[['auto', 'おまかせ（状況に応じて自動調整）'], ['soft', 'いつもやわらかく'], ['bold', 'いつもはっきり']]} />
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: -8, marginBottom: 14 }}>
          おまかせが基本。気分が落ちている日は自動的にやわらかく、調子が良い日は少し踏み込みます。
        </div>

        <Field label="名前（内部用）" value={form.chat_nickname} onChange={(v) => update('chat_nickname', v)} placeholder="あなたの名前" />
        <Field label="仕事・役割" value={form.chat_occupation} onChange={(v) => update('chat_occupation', v)} placeholder="例: AI開発者、フリーランスコンサル" />
        <Field label="自己紹介" value={form.chat_about} onChange={(v) => update('chat_about', v)} placeholder="大事にしている価値観、興味、関心..." textarea />

        <div style={{ display: 'flex', gap: 24, marginBottom: 14 }}>
          <Toggle label="大局的な傾向を使う" checked={form.chat_memory_enabled} onChange={(v) => update('chat_memory_enabled', v)} />
          <Toggle label="日記を参照する" checked={form.chat_diary_enabled} onChange={(v) => update('chat_diary_enabled', v)} />
        </div>

        <Field label="追加の指示" value={form.chat_custom_instructions} onChange={(v) => update('chat_custom_instructions', v)} placeholder="AIへの追加リクエスト（任意）" textarea />

        <button className="btn btn-primary" onClick={save}>保存</button>
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

      <ClaudeMdViewer settings={settings} />
    </>
  )
}

function ClaudeMdViewer({ settings }: { settings: ClaudeSettings[] }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const mdEntries = settings.filter((s) => s.claude_md_content)
  if (mdEntries.length === 0) return null

  const toggleScope = (scope: string) => setExpanded((prev) => ({ ...prev, [scope]: !prev[scope] }))
  const lineCount = (content: string) => content.split('\n').length

  return (
    <>
      <div className="section-title">CLAUDE.md ({mdEntries.length})</div>
      {mdEntries.map((s) => {
        const isOpen = expanded[s.scope] ?? false
        const content = s.claude_md_content || ''
        const lines = lineCount(content)
        return (
          <Card key={s.scope} style={{ marginBottom: 12, cursor: 'pointer' }} onClick={() => toggleScope(s.scope)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--text3)', flex: 1, fontFamily: 'var(--mono)' }}>{s.scope}</span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>{lines} lines</span>
              <span style={{ fontSize: 12, color: 'var(--text3)', userSelect: 'none' }}>{isOpen ? '▲' : '▼'}</span>
            </div>
            {isOpen && (
              <pre style={{
                marginTop: 12, fontSize: 11, fontFamily: 'var(--mono)',
                color: 'var(--text2)', background: 'var(--bg2)',
                padding: 12, borderRadius: 6,
                maxHeight: 400, overflowY: 'auto',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }} onClick={(e) => e.stopPropagation()}>
                {content}
              </pre>
            )}
          </Card>
        )
      })}
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
// AI Model Config Section
// ============================================================

const MODEL_OPTIONS: [string, string][] = [
  ['claude-opus-4-7',          'Claude Opus 4.7（最高精度・低速）'],
  ['claude-sonnet-4-6',        'Claude Sonnet 4.6（バランス）'],
  ['claude-haiku-4-5-20251001', 'Claude Haiku 4.5（高速・低コスト）'],
]

interface AppConfigRow {
  key: string
  value: string
  label: string
  description: string
}

function AIModelSection() {
  const [rows, setRows] = useState<AppConfigRow[]>([])
  const [form, setForm] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('app_config')
      .select('key, value, label, description')
      .like('key', 'batch.%')
      .order('key')
      .then(({ data }) => {
        const items = (data || []) as AppConfigRow[]
        setRows(items)
        const initial: Record<string, string> = {}
        for (const r of items) initial[r.key] = r.value
        setForm(initial)
        setLoading(false)
      })
  }, [])

  const save = async () => {
    const updates = rows.map((r) =>
      supabase.from('app_config').update({ value: form[r.key], updated_at: new Date().toISOString() }).eq('key', r.key)
    )
    await Promise.all(updates)
    toast('モデル設定を保存しました')
  }

  if (loading) return <div className="skeleton-card" style={{ height: 80 }} />

  return (
    <>
      <div className="gradient-line" />
      <div className="section-title">AI モデル設定</div>
      <Card style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16, lineHeight: 1.7 }}>
          バッチ処理で使用する LLM モデルを設定します。変更は次回のバッチ実行から反映されます。
        </p>
        {rows.map((r) => (
          <div key={r.key} style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{r.label}</div>
            {r.description && (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>{r.description}</div>
            )}
            <select
              className="input"
              value={form[r.key] || ''}
              onChange={(e) => setForm((f) => ({ ...f, [r.key]: e.target.value }))}
              style={{ fontSize: 13 }}
            >
              {MODEL_OPTIONS.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="empty">設定が見つかりません。マイグレーション 068 を適用してください。</div>
        )}
        {rows.length > 0 && (
          <button className="btn btn-primary btn-sm" onClick={save}>保存</button>
        )}
      </Card>
    </>
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
      <PartnerFeedbackSettings />
      <ApiKeysSection settings={userSettings} userId={userId} />
      <AIModelSection />
      <DataExportSection />
      {isCliMode && <ClaudeCodeSection settings={claudeSettings} />}
    </div>
  )
}

// ============================================================
// DataExportSection — design-philosophy ⑤ File-based Transparency
// ============================================================
//
// Your data is yours. This section lets you download every personal
// record (diary, emotions, Narrator memory, tasks, dreams, ...) as a
// single JSON file. Regenerated / ephemeral tables and org-level
// masters (companies, departments, slash_commands, _migrations ...)
// are excluded.

/** Tables that contain personal authored content or personal AI analysis. */
const EXPORT_TABLES = [
  'diary_entries',
  'diary_entry_revisions',
  'emotion_analysis',
  'diary_analysis',
  'story_memory',
  'story_moments',
  'dreams',
  'goals',
  'habits',
  'habit_logs',
  'tasks',
  'task_calendar_links',
  'calendar_events',
  'self_analysis',
  'life_story_entries',
  'weekly_narratives',
  'ceo_insights',
  'prompt_log',
  'prompt_sessions',
  'messages',
  'conversations',
  'chat_interactions',
  'ai_partner_feedback',
  'ai_partner_distilled_lessons',
  'ai_partner_prompt_rules',
  'ai_partner_memories',
  'user_manual_cards',
  'growth_events',
  'time_entries',
  'wishlist',
  'secretary_notes',
  'knowledge_base',
  'user_settings',
]

function DataExportSection() {
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)

  const exportAll = async () => {
    setBusy(true)
    setProgress('データを集めています...')
    const out: Record<string, unknown> = {
      _meta: {
        exported_at: new Date().toISOString(),
        source: 'focus-you',
        schema_version: 1,
      },
    }
    let failedCount = 0
    for (const t of EXPORT_TABLES) {
      setProgress(`取得中: ${t}`)
      const { data, error } = await supabase.from(t).select('*').limit(100000)
      if (error) {
        console.warn(`[DataExport] ${t} failed:`, error)
        failedCount++
        out[t] = { error: error.message }
      } else {
        out[t] = data ?? []
      }
    }
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const today = new Date().toISOString().substring(0, 10)
    a.download = `focus-you-export-${today}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setProgress(null)
    setBusy(false)
    toast(
      failedCount > 0
        ? `エクスポート完了（${EXPORT_TABLES.length - failedCount}/${EXPORT_TABLES.length} テーブル。一部失敗はコンソール参照）`
        : `エクスポート完了（${EXPORT_TABLES.length} テーブル）`,
    )
  }

  return (
    <Card style={{ marginTop: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>データのエクスポート</div>
      <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.7, marginBottom: 12 }}>
        あなたのデータはあなたのものです。日記・感情分析・Narrator の解釈・夢・タスクなど、個人に紐づく
        すべての記録を1つのJSONファイルとしてダウンロードできます。ベンダーロックイン回避のため、
        どこかに移したくなった時にもこのエクスポートだけで完結します。
      </div>
      <button className="btn btn-primary btn-sm" onClick={exportAll} disabled={busy}>
        {busy ? (progress ?? '処理中...') : '全データをダウンロード（JSON）'}
      </button>
    </Card>
  )
}
