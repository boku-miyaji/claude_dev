import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui'
import { toast } from '@/components/ui/Toast'
import { useDataStore } from '@/stores/data'

const MAX_VISIBLE = 5

function formatWhen(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  }
  const y = new Date(now); y.setDate(y.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return '昨日'
  return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
}

export function TodayIdeasCard() {
  const { ideas, fetchIdeas, addIdea } = useDataStore()
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchIdeas() }, [fetchIdeas])

  const recent = useMemo(() => ideas.slice(0, MAX_VISIBLE), [ideas])

  const onSubmit = useCallback(async () => {
    const content = text.trim()
    if (!content || saving) return
    setSaving(true)
    const created = await addIdea({ content, status: 'raw', tags: [] })
    setSaving(false)
    if (created) {
      setText('')
    } else {
      toast('保存に失敗しました')
    }
  }, [text, saving, addIdea])

  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--text3)', letterSpacing: 0.5 }}>IDEAS</div>
        <Link
          to="/ideas"
          style={{ fontSize: 11, color: 'var(--text3)', textDecoration: 'none' }}
        >
          すべて見る{ideas.length > 0 ? ` (${ideas.length})` : ''} →
        </Link>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: recent.length > 0 ? 10 : 0 }}>
        <input
          className="input"
          placeholder="思いついたこと…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault()
              onSubmit()
            }
          }}
          style={{ flex: 1, fontSize: 13 }}
        />
        <button
          className="btn btn-primary btn-sm"
          onClick={onSubmit}
          disabled={!text.trim() || saving}
          title="Cmd/Ctrl+Enter でも保存"
        >
          ＋
        </button>
      </div>

      {recent.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {recent.map((idea) => (
            <li
              key={idea.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: 8,
                fontSize: 13,
                padding: '4px 0',
                borderTop: '1px solid var(--border)',
                opacity: idea.status === 'rejected' ? 0.45 : 1,
              }}
            >
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textDecoration: idea.status === 'rejected' ? 'line-through' : 'none',
                }}
              >
                {idea.content}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text3)', flexShrink: 0 }}>
                {formatWhen(idea.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
