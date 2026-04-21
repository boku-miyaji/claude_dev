import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, PageHeader, EmptyState, Tag, SkeletonRows } from '@/components/ui'
import { toast } from '@/components/ui/Toast'
import { useDataStore } from '@/stores/data'
import { IDEA_STATUSES } from '@/types/ideas'
import type { Idea, IdeaStatus } from '@/types/ideas'

type FilterStatus = 'all' | IdeaStatus

const STATUS_COLOR: Record<IdeaStatus, string> = {
  raw: 'var(--text3)',
  review: 'var(--accent)',
  adopted: 'var(--success, #10b981)',
  rejected: 'var(--text3)',
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const y = new Date(now); y.setDate(y.getDate() - 1)
  const yesterday = d.toDateString() === y.toDateString()
  if (sameDay) return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  if (yesterday) return '昨日'
  return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
}

export function Ideas() {
  const { ideas, fetchIdeas, addIdea, updateIdea, deleteIdea } = useDataStore()
  const loading = useDataStore((s) => s.loading.ideas)

  const [filter, setFilter] = useState<FilterStatus>('all')
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [tagEditId, setTagEditId] = useState<string | null>(null)
  const [tagEditValue, setTagEditValue] = useState('')

  useEffect(() => { fetchIdeas() }, [fetchIdeas])

  const visible = useMemo(
    () => (filter === 'all' ? ideas : ideas.filter((i) => i.status === filter)),
    [ideas, filter],
  )

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: ideas.length }
    for (const s of IDEA_STATUSES) c[s.value] = 0
    for (const i of ideas) c[i.status] = (c[i.status] ?? 0) + 1
    return c
  }, [ideas])

  const onSubmit = useCallback(async () => {
    const content = text.trim()
    if (!content || saving) return
    setSaving(true)
    const created = await addIdea({ content, status: 'raw', tags: [] })
    setSaving(false)
    if (created) {
      setText('')
      toast('アイデアを追加')
    } else {
      toast('保存に失敗しました')
    }
  }, [text, saving, addIdea])

  const onStatusChange = useCallback(async (idea: Idea, next: IdeaStatus) => {
    if (idea.status === next) return
    await updateIdea(idea.id, { status: next })
  }, [updateIdea])

  const startEditContent = (idea: Idea) => {
    setEditingId(idea.id)
    setEditingContent(idea.content)
  }

  const commitEditContent = async () => {
    if (!editingId) return
    const c = editingContent.trim()
    if (c && c !== (ideas.find((i) => i.id === editingId)?.content ?? '')) {
      await updateIdea(editingId, { content: c })
    }
    setEditingId(null)
    setEditingContent('')
  }

  const commitTag = async (idea: Idea) => {
    const raw = tagEditValue.trim()
    const next = raw
      ? Array.from(new Set(raw.split(/[,\s]+/).map((t) => t.replace(/^#/, '').trim()).filter(Boolean)))
      : []
    await updateIdea(idea.id, { tags: next })
    setTagEditId(null)
    setTagEditValue('')
  }

  const onDelete = useCallback(async (idea: Idea) => {
    const snippet = idea.content.length > 24 ? idea.content.slice(0, 24) + '…' : idea.content
    if (!window.confirm(`削除しますか？\n\n「${snippet}」`)) return
    await deleteIdea(idea.id)
    toast('削除しました')
  }, [deleteIdea])

  return (
    <div className="page">
      <PageHeader
        title="Ideas"
        description="思いついたことを貯める場所。書き捨ててOK、育てたければ状態を変える。"
      />

      {/* 入力 */}
      <Card style={{ marginBottom: 16 }}>
        <textarea
          className="input"
          placeholder="思いついたこと…（Cmd/Ctrl+Enter で保存）"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault()
              onSubmit()
            }
          }}
          style={{ minHeight: 56, width: '100%', boxSizing: 'border-box', marginBottom: 8 }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={onSubmit}
            disabled={!text.trim() || saving}
          >
            {saving ? '保存中…' : '追加'}
          </button>
        </div>
      </Card>

      {/* フィルタ */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {(['all', ...IDEA_STATUSES.map((s) => s.value)] as FilterStatus[]).map((f) => {
          const label = f === 'all' ? 'すべて' : IDEA_STATUSES.find((s) => s.value === f)!.label
          const active = filter === f
          return (
            <button
              key={f}
              className={`btn btn-sm ${active ? 'btn-primary' : 'btn-g'}`}
              onClick={() => setFilter(f)}
            >
              {label} <span style={{ opacity: 0.6 }}>({counts[f] ?? 0})</span>
            </button>
          )
        })}
      </div>

      {/* 一覧 */}
      {loading && ideas.length === 0 ? (
        <SkeletonRows count={5} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="💡"
          message={filter === 'all' ? 'まだアイデアはありません。上の入力欄に書いてみてください。' : '該当するアイデアはありません。'}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visible.map((idea) => (
            <Card key={idea.id} style={{ padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                {/* content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editingId === idea.id ? (
                    <textarea
                      className="input"
                      value={editingContent}
                      autoFocus
                      onChange={(e) => setEditingContent(e.target.value)}
                      onBlur={commitEditContent}
                      onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                          e.preventDefault()
                          commitEditContent()
                        } else if (e.key === 'Escape') {
                          setEditingId(null)
                          setEditingContent('')
                        }
                      }}
                      style={{ width: '100%', minHeight: 48, boxSizing: 'border-box' }}
                    />
                  ) : (
                    <div
                      onClick={() => startEditContent(idea)}
                      style={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        cursor: 'text',
                        opacity: idea.status === 'rejected' ? 0.5 : 1,
                        textDecoration: idea.status === 'rejected' ? 'line-through' : 'none',
                      }}
                    >
                      {idea.content}
                    </div>
                  )}

                  {/* tags */}
                  <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {idea.tags.map((t) => (
                      <Tag key={t}>{`#${t}`}</Tag>
                    ))}
                    {tagEditId === idea.id ? (
                      <input
                        className="input"
                        autoFocus
                        value={tagEditValue}
                        placeholder="tag1, tag2"
                        onChange={(e) => setTagEditValue(e.target.value)}
                        onBlur={() => commitTag(idea)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); commitTag(idea) }
                          else if (e.key === 'Escape') { setTagEditId(null); setTagEditValue('') }
                        }}
                        style={{ fontSize: 12, padding: '2px 6px', width: 200 }}
                      />
                    ) : (
                      <button
                        className="btn btn-g btn-sm"
                        style={{ fontSize: 11, padding: '2px 6px' }}
                        onClick={() => { setTagEditId(idea.id); setTagEditValue(idea.tags.join(', ')) }}
                      >
                        {idea.tags.length > 0 ? '編集' : '＋タグ'}
                      </button>
                    )}
                  </div>
                </div>

                {/* meta + actions */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{formatWhen(idea.created_at)}</div>
                  <select
                    className="input"
                    value={idea.status}
                    onChange={(e) => onStatusChange(idea, e.target.value as IdeaStatus)}
                    style={{ fontSize: 11, padding: '2px 4px', color: STATUS_COLOR[idea.status] }}
                  >
                    {IDEA_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  <button
                    className="btn btn-g btn-sm"
                    onClick={() => onDelete(idea)}
                    title="削除"
                    style={{ fontSize: 11, padding: '2px 6px', color: 'var(--danger, #dc2626)' }}
                  >
                    削除
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
