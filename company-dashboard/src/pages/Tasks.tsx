import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PageHeader, EmptyState, Tag, SkeletonRows } from '@/components/ui'
import { toast } from '@/components/ui/Toast'

interface Task {
  id: string
  title: string
  description: string | null
  type: string
  priority: string
  status: string
  company_id: string | null
  due_date: string | null
  completed_at: string | null
  created_at: string
  companies: { name: string } | null
}

interface Company {
  id: string
  name: string
}

export function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ status: 'open', company: '', priority: '' })
  const [showAdd, setShowAdd] = useState(false)

  // Form state
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newType, setNewType] = useState('todo')
  const [newCompany, setNewCompany] = useState('')
  const [newPriority, setNewPriority] = useState('normal')

  // Edit state
  const [editing, setEditing] = useState<Task | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [cosRes, tasksRes] = await Promise.all([
      supabase.from('companies').select('id, name').eq('status', 'active'),
      supabase.from('tasks').select('*, companies(name)').order('created_at', { ascending: false }),
    ])
    setCompanies(cosRes.data || [])
    setTasks((tasksRes.data as Task[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = tasks.filter((t) => {
    if (filters.status && t.status !== filters.status) return false
    if (filters.company && t.company_id !== filters.company) return false
    if (filters.priority && t.priority !== filters.priority) return false
    return true
  })

  async function addTask() {
    if (!newTitle.trim()) return
    const { data } = await supabase.from('tasks').insert({
      company_id: newCompany || null,
      type: newType,
      title: newTitle.trim(),
      description: newDesc.trim() || null,
      priority: newPriority,
    }).select('*, companies(name)')
    if (data?.[0]) setTasks((prev) => [data[0] as Task, ...prev])
    setNewTitle('')
    setNewDesc('')
    toast(`"${newTitle.trim()}" を追加しました`)
  }

  async function toggleStatus(t: Task) {
    const newStatus = t.status === 'done' ? 'open' : 'done'
    await supabase.from('tasks').update({
      status: newStatus,
      completed_at: newStatus === 'done' ? new Date().toISOString() : null,
    }).eq('id', t.id)
    setTasks((prev) => prev.map((x) => x.id === t.id ? { ...x, status: newStatus } : x))
    toast(`"${t.title}" を${newStatus === 'done' ? '完了' : '再オープン'}しました`)
  }

  async function deleteTask(t: Task) {
    if (!confirm(`"${t.title}" を削除しますか？`)) return
    await supabase.from('tasks').delete().eq('id', t.id)
    setTasks((prev) => prev.filter((x) => x.id !== t.id))
    toast(`"${t.title}" を削除しました`)
  }

  async function saveEdit() {
    if (!editing) return
    await supabase.from('tasks').update({
      title: editing.title,
      description: editing.description,
      priority: editing.priority,
      status: editing.status,
      due_date: editing.due_date || null,
    }).eq('id', editing.id)
    setTasks((prev) => prev.map((x) => x.id === editing.id ? { ...x, ...editing } : x))
    toast('更新しました')
    setEditing(null)
  }

  if (loading) return <div className="page"><PageHeader title="Tasks" /><SkeletonRows count={6} /></div>

  return (
    <div className="page">
      <PageHeader
        title="Tasks"
        description="全PJ会社のタスク一覧・追加・コメント"
        actions={
          <button className="btn btn-p btn-sm" onClick={() => setShowAdd(!showAdd)}>
            {showAdd ? '- 閉じる' : '+ タスク追加'}
          </button>
        }
      />

      {/* Add form */}
      {showAdd && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="form-row" style={{ marginBottom: 8 }}>
            <select className="input" value={newType} onChange={(e) => setNewType(e.target.value)}>
              <option value="todo">Todo</option>
              <option value="task">Task</option>
              <option value="request">Request</option>
            </select>
            <select className="input" value={newCompany} onChange={(e) => setNewCompany(e.target.value)}>
              <option value="">HD（全社）</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="input" value={newPriority} onChange={(e) => setNewPriority(e.target.value)}>
              <option value="normal">normal</option>
              <option value="high">high</option>
              <option value="low">low</option>
            </select>
          </div>
          <input className="input" placeholder="何をする？" value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addTask() }}
            style={{ marginBottom: 8, width: '100%', boxSizing: 'border-box' }}
          />
          <textarea className="input" placeholder="詳細（任意）" value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            style={{ minHeight: 50, marginBottom: 10, width: '100%', boxSizing: 'border-box' }}
          />
          <button className="btn btn-p" style={{ width: '100%' }} onClick={addTask}>追加</button>
        </div>
      )}

      {/* Filters */}
      <div className="filter-bar">
        <select className="input" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
          <option value="">すべて</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select className="input" value={filters.company} onChange={(e) => setFilters((f) => ({ ...f, company: e.target.value }))}>
          <option value="">すべての会社</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input" value={filters.priority} onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}>
          <option value="">すべての優先度</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Task list */}
      <div className="card">
        {filtered.length === 0 ? (
          <EmptyState icon="☐" message="フィルターに一致するタスクはありません"
            actionLabel="フィルターをリセット"
            onAction={() => setFilters({ status: '', company: '', priority: '' })}
          />
        ) : filtered.map((t) => {
          const isDone = t.status === 'done'
          return (
            <div key={t.id} className="task-item">
              <button className={`task-check${isDone ? ' done' : ''}`} onClick={() => toggleStatus(t)}>
                {isDone ? '✓' : ''}
              </button>
              <div className="task-body">
                <div className={`task-title${isDone ? ' done' : ''}`}>{t.title}</div>
                {t.description && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>{t.description.substring(0, 120)}</div>}
                <div className="task-meta">
                  <Tag variant="company">{t.company_id || 'HD'}</Tag>
                  <Tag variant={t.priority as 'high' | 'normal' | 'low'}>{t.priority}</Tag>
                  <Tag variant={t.status as 'open' | 'done' | 'in_progress'}>{t.status}</Tag>
                  {t.due_date && <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>{t.due_date}</span>}
                </div>
              </div>
              <div className="task-actions">
                <button className="task-act-btn" title="Edit" onClick={() => setEditing({ ...t })}>✎</button>
                <button className="task-act-btn" title="Delete" onClick={() => deleteTask(t)}>&times;</button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setEditing(null) }}>
          <div className="modal">
            <div className="modal-header">
              <span>タスクを編集</span>
              <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text3)' }}>&times;</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 10 }}>
                <label className="form-label">タイトル</label>
                <input className="input" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} style={{ width: '100%', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label className="form-label">詳細</label>
                <textarea className="input" value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', minHeight: 60 }} />
              </div>
              <div className="form-row" style={{ marginBottom: 10 }}>
                <div>
                  <label className="form-label">優先度</label>
                  <select className="input" value={editing.priority} onChange={(e) => setEditing({ ...editing, priority: e.target.value })}>
                    <option value="high">high</option><option value="normal">normal</option><option value="low">low</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">ステータス</label>
                  <select className="input" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                    <option value="open">open</option><option value="in_progress">in_progress</option><option value="done">done</option><option value="cancelled">cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">期限</label>
                  <input className="input" type="date" value={editing.due_date || ''} onChange={(e) => setEditing({ ...editing, due_date: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-g" onClick={() => setEditing(null)}>キャンセル</button>
              <button className="btn btn-p" onClick={saveEdit}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
