import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  sort_order: number
  companies: { name: string } | null
}

interface Company {
  id: string
  name: string
}

type TabType = 'task' | 'request'

export function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('task')
  const [filters, setFilters] = useState({ status: 'open', company: '', priority: '' })
  const [showAdd, setShowAdd] = useState(false)

  // Form state
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newCompany, setNewCompany] = useState('')
  const [newPriority, setNewPriority] = useState('normal')
  const [newDueDate, setNewDueDate] = useState('')

  // Edit state
  const [editing, setEditing] = useState<Task | null>(null)

  // Drag state
  const dragItem = useRef<string | null>(null)
  const dragOverItem = useRef<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [cosRes, tasksRes] = await Promise.all([
      supabase.from('companies').select('id, name').eq('status', 'active'),
      supabase.from('tasks').select('*, companies(name)').order('sort_order', { ascending: true }),
    ])
    setCompanies(cosRes.data || [])
    setTasks((tasksRes.data as Task[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const counts = useMemo(() => ({
    task: tasks.filter((t) => t.type === 'task' && (t.status === 'open' || t.status === 'in_progress')).length,
    request: tasks.filter((t) => t.type === 'request' && (t.status === 'open' || t.status === 'in_progress')).length,
  }), [tasks])

  const sorted = useMemo(() => {
    return tasks.filter((t) => {
      if (t.type !== activeTab) return false
      if (filters.status && t.status !== filters.status) return false
      if (filters.company && t.company_id !== filters.company) return false
      if (filters.priority && t.priority !== filters.priority) return false
      return true
    })
  }, [tasks, activeTab, filters])

  async function addTask() {
    if (!newTitle.trim()) return
    // New task gets sort_order 0 (top of list)
    const minOrder = Math.min(0, ...tasks.filter((t) => t.type === activeTab).map((t) => t.sort_order)) - 1
    const { data } = await supabase.from('tasks').insert({
      company_id: newCompany || null,
      type: activeTab,
      title: newTitle.trim(),
      description: newDesc.trim() || null,
      priority: newPriority,
      due_date: newDueDate || null,
      sort_order: minOrder,
    }).select('*, companies(name)')
    if (data?.[0]) setTasks((prev) => [data[0] as Task, ...prev])
    setNewTitle('')
    setNewDesc('')
    setNewDueDate('')
    setShowAdd(false)
    toast('追加しました')
  }

  async function toggleStatus(t: Task) {
    const newStatus = t.status === 'done' ? 'open' : 'done'
    await supabase.from('tasks').update({
      status: newStatus,
      completed_at: newStatus === 'done' ? new Date().toISOString() : null,
    }).eq('id', t.id)
    setTasks((prev) => prev.map((x) => x.id === t.id ? { ...x, status: newStatus, completed_at: newStatus === 'done' ? new Date().toISOString() : null } : x))
    toast(newStatus === 'done' ? '完了しました' : '再オープンしました')
  }

  async function toggleType(t: Task) {
    const newType = t.type === 'task' ? 'request' : 'task'
    await supabase.from('tasks').update({ type: newType }).eq('id', t.id)
    setTasks((prev) => prev.map((x) => x.id === t.id ? { ...x, type: newType } : x))
    toast(`${newType === 'task' ? 'Task' : 'Request'} に変更しました`)
  }

  async function deleteTask(t: Task) {
    if (!confirm(`"${t.title}" を削除しますか？`)) return
    await supabase.from('tasks').delete().eq('id', t.id)
    setTasks((prev) => prev.filter((x) => x.id !== t.id))
    toast('削除しました')
  }

  async function saveEdit() {
    if (!editing) return
    await supabase.from('tasks').update({
      title: editing.title,
      description: editing.description,
      priority: editing.priority,
      status: editing.status,
      type: editing.type,
      due_date: editing.due_date || null,
      company_id: editing.company_id || null,
    }).eq('id', editing.id)
    setTasks((prev) => prev.map((x) => x.id === editing.id ? { ...x, ...editing } : x))
    toast('更新しました')
    setEditing(null)
  }

  // --- Drag & Drop ---
  function handleDragStart(id: string) {
    dragItem.current = id
    setDraggingId(id)
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault()
    dragOverItem.current = id
    setDragOverId(id)
  }

  async function handleDrop() {
    const fromId = dragItem.current
    const toId = dragOverItem.current
    setDraggingId(null)
    setDragOverId(null)
    dragItem.current = null
    dragOverItem.current = null

    if (!fromId || !toId || fromId === toId) return

    const items = [...sorted]
    const fromIdx = items.findIndex((t) => t.id === fromId)
    const toIdx = items.findIndex((t) => t.id === toId)
    if (fromIdx === -1 || toIdx === -1) return

    // Reorder
    const [moved] = items.splice(fromIdx, 1)
    items.splice(toIdx, 0, moved)

    // Assign new sort_order values
    const updates = items.map((t, i) => ({ id: t.id, sort_order: i }))

    // Optimistic update
    setTasks((prev) => {
      const updated = [...prev]
      for (const u of updates) {
        const idx = updated.findIndex((t) => t.id === u.id)
        if (idx !== -1) updated[idx] = { ...updated[idx], sort_order: u.sort_order }
      }
      return updated.sort((a, b) => a.sort_order - b.sort_order)
    })

    // Persist to DB
    for (const u of updates) {
      await supabase.from('tasks').update({ sort_order: u.sort_order }).eq('id', u.id)
    }
  }

  function handleDragEnd() {
    setDraggingId(null)
    setDragOverId(null)
  }

  if (loading) return <div className="page"><PageHeader title="Tasks" /><SkeletonRows count={6} /></div>

  const todayStr = new Date().toISOString().substring(0, 10)

  return (
    <div className="page">
      <PageHeader
        title="Tasks"
        description="タスクと依頼を一元管理。ドラッグで優先順を変更"
        actions={
          <button className="btn btn-p btn-sm" onClick={() => setShowAdd(!showAdd)}>
            {showAdd ? '閉じる' : `+ ${activeTab === 'task' ? 'タスク' : 'リクエスト'}追加`}
          </button>
        }
      />

      {/* Tabs */}
      <div className="tasks-tabs">
        <button
          className={`tasks-tab${activeTab === 'task' ? ' active' : ''}`}
          onClick={() => { setActiveTab('task'); setShowAdd(false) }}
        >
          Tasks
          {counts.task > 0 && <span className="tasks-tab-count">{counts.task}</span>}
        </button>
        <button
          className={`tasks-tab${activeTab === 'request' ? ' active' : ''}`}
          onClick={() => { setActiveTab('request'); setShowAdd(false) }}
        >
          Requests
          {counts.request > 0 && <span className="tasks-tab-count tasks-tab-count--req">{counts.request}</span>}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="tasks-add-form card">
          <input
            className="input tasks-add-title"
            placeholder={activeTab === 'task' ? '何をする？' : '依頼内容'}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            autoFocus
          />
          <textarea
            className="input"
            placeholder="詳細（任意）"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            style={{ minHeight: 48 }}
          />
          <div className="tasks-add-row">
            <select className="input" value={newCompany} onChange={(e) => setNewCompany(e.target.value)}>
              <option value="">HD</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="input" value={newPriority} onChange={(e) => setNewPriority(e.target.value)}>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="low">Low</option>
            </select>
            <input className="input" type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
            <button className="btn btn-p" onClick={addTask} disabled={!newTitle.trim()}>追加</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="tasks-toolbar">
        <div className="tasks-filters">
          <select className="input" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select className="input" value={filters.company} onChange={(e) => setFilters((f) => ({ ...f, company: e.target.value }))}>
            <option value="">All Companies</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="input" value={filters.priority} onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}>
            <option value="">All Priority</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* List */}
      <div className="card tasks-list">
        {sorted.length === 0 ? (
          <EmptyState
            icon={activeTab === 'task' ? '☐' : '↗'}
            message={`${activeTab === 'task' ? 'タスク' : 'リクエスト'}はありません`}
            actionLabel="フィルターをリセット"
            onAction={() => setFilters({ status: '', company: '', priority: '' })}
          />
        ) : sorted.map((t) => {
          const isDone = t.status === 'done'
          const isOverdue = t.due_date && t.due_date < todayStr && !isDone
          return (
            <div
              key={t.id}
              className={`tasks-row${isDone ? ' done' : ''}${isOverdue ? ' overdue' : ''}${draggingId === t.id ? ' dragging' : ''}${dragOverId === t.id ? ' drag-over' : ''}`}
              draggable
              onDragStart={() => handleDragStart(t.id)}
              onDragOver={(e) => handleDragOver(e, t.id)}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
            >
              <div className="tasks-drag-handle" title="ドラッグで並び替え">⠿</div>
              <button className={`tasks-check${isDone ? ' checked' : ''}`} onClick={() => toggleStatus(t)}>
                {isDone && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 3.5L3.5 6L9 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </button>
              <div className="tasks-content" onClick={() => setEditing({ ...t })}>
                <div className="tasks-title-row">
                  <span className={`tasks-title${isDone ? ' done' : ''}`}>{t.title}</span>
                  {isOverdue && <span className="tasks-overdue-badge">overdue</span>}
                </div>
                {t.description && <div className="tasks-desc">{t.description.substring(0, 140)}</div>}
                <div className="tasks-meta">
                  <span className="tasks-meta-item">{t.companies?.name || 'HD'}</span>
                  <span className={`tasks-priority tasks-priority--${t.priority}`}>{t.priority}</span>
                  {t.due_date && <span className="tasks-meta-item tasks-meta-date">{t.due_date}</span>}
                  <Tag variant={t.status as 'open' | 'done' | 'in_progress'}>{t.status}</Tag>
                </div>
              </div>
              <div className="tasks-actions">
                <button className="tasks-action-btn" onClick={() => toggleType(t)}>
                  → {t.type === 'task' ? 'Request' : 'Task'}
                </button>
                <button className="tasks-action-btn danger" onClick={() => deleteTask(t)}>削除</button>
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
              <span style={{ fontWeight: 600, fontSize: 15 }}>編集</span>
              <button className="modal-close" onClick={() => setEditing(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 14 }}>
                <label className="form-label">タイトル</label>
                <input className="input" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} style={{ width: '100%' }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label className="form-label">詳細</label>
                <textarea className="input" value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} style={{ width: '100%', minHeight: 60 }} />
              </div>
              <div className="form-row">
                <div style={{ flex: 1 }}>
                  <label className="form-label">タイプ</label>
                  <select className="input" value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })} style={{ width: '100%' }}>
                    <option value="task">Task</option>
                    <option value="request">Request</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">会社</label>
                  <select className="input" value={editing.company_id || ''} onChange={(e) => setEditing({ ...editing, company_id: e.target.value || null })} style={{ width: '100%' }}>
                    <option value="">HD</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row" style={{ marginTop: 14 }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">優先度</label>
                  <select className="input" value={editing.priority} onChange={(e) => setEditing({ ...editing, priority: e.target.value })} style={{ width: '100%' }}>
                    <option value="high">High</option>
                    <option value="normal">Normal</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">ステータス</label>
                  <select className="input" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })} style={{ width: '100%' }}>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">期限</label>
                  <input className="input" type="date" value={editing.due_date || ''} onChange={(e) => setEditing({ ...editing, due_date: e.target.value })} style={{ width: '100%' }} />
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
