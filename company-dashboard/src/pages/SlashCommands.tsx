import { PageHeader, KpiCard, EmptyState } from '@/components/ui'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'

interface SlashCommand {
  id: string
  trigger: string
  description: string
  category: string
  source: string
  source_path: string
  status: string
}

const CAT_META: Record<string, { label: string; icon: string; color: string }> = {
  organization: { label: '組織・タスク管理', icon: '◫', color: 'var(--blue)' },
  permission: { label: '権限・設定管理', icon: '⚙', color: 'var(--amber)' },
  utility: { label: 'ユーティリティ', icon: '◇', color: 'var(--green)' },
  workflow: { label: 'ワークフロー', icon: '▷', color: '#8b5cf6' },
  document: { label: 'ドキュメント・資料', icon: '◆', color: '#eab308' },
  analysis: { label: '分析・可視化', icon: '◈', color: '#06b6d4' },
  development: { label: '開発支援', icon: '☐', color: 'var(--red)' },
  other: { label: 'その他', icon: '○', color: 'var(--text3)' },
}

export function SlashCommands() {
  const { data: cmds, loading } = useSupabaseQuery<SlashCommand>({
    table: 'slash_commands',
    select: '*',
    filters: [{ column: 'status', op: 'eq', value: 'active' }],
    order: { column: 'category' },
  })

  if (loading) return <div className="page"><PageHeader title="Slash Commands" /><div className="skeleton skeleton-card" /></div>

  const commands = cmds || []
  if (commands.length === 0) {
    return (
      <div className="page">
        <PageHeader title="Slash Commands" description="カスタムスキル・スラッシュコマンドの一覧（カテゴリ別）" />
        <EmptyState message="コマンドが登録されていません。次のセッション起動時に自動同期されます。" />
      </div>
    )
  }

  // Group by category
  const grouped: Record<string, SlashCommand[]> = {}
  commands.forEach((c) => {
    if (!grouped[c.category]) grouped[c.category] = []
    grouped[c.category].push(c)
  })
  const catKeys = Object.keys(grouped).sort()

  return (
    <div className="page">
      <PageHeader title="Slash Commands" description="カスタムスキル・スラッシュコマンドの一覧（カテゴリ別）" />

      <div className="g4" style={{ marginBottom: 28 }}>
        <KpiCard value={commands.length} label="Total Commands" status="good" />
        <KpiCard value={catKeys.length} label="Categories" />
      </div>

      {catKeys.map((cat) => {
        const meta = CAT_META[cat] || CAT_META.other
        const items = grouped[cat]
        return (
          <div key={cat} style={{ marginBottom: 24 }}>
            <div className="section-title" style={{ color: meta.color }}>
              {meta.icon} {meta.label} ({items.length})
            </div>
            <div className="card">
              {items.map((cmd, i) => (
                <div key={cmd.id} style={{
                  padding: '12px 16px',
                  borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
                  display: 'flex', alignItems: 'flex-start', gap: 16,
                }}>
                  <code style={{
                    background: 'var(--accent-bg)', color: 'var(--accent)',
                    padding: '3px 10px', borderRadius: 4, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
                  }}>
                    {cmd.trigger}
                  </code>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {cmd.description && (
                      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{cmd.description}</div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                      {cmd.source}
                      {cmd.source_path && <> · <span style={{ opacity: 0.7 }}>{cmd.source_path}</span></>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
