import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PageHeader, EmptyState, Tag, SkeletonRows } from '@/components/ui'
import { toast } from '@/components/ui/Toast'
import { useDataStore } from '@/stores/data'
import type { Task } from '@/types/tasks'

interface Company {
  id: string
  name: string
}

export function Requests() {
  const { tasks, fetchTasks, addTask, updateTask, deleteTask } = useDataStore()
  const loading = useDataStore((s) => s.loading.tasks)

  const [companies, setCompanies] = useState<Company[]>([])
  const [filters, setFilters] = useState({ status: 'open', company: '', priority: '' })
  const [showAdd, setShowAdd] = useState(false)

  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newCompany, setNewCompany] = useState('')
  const [newPriority, setNewPriority] = useState('normal')
  const [newDueDate, setNewDueDate] = useState('')

  const [editing, setEditing] = useState<Task | null>(null)

  const dragItem = useRef<string | null>(null)
  const dragOverItem = useRef<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('companies').select('id, name').eq('status', 'active')
    setCompanies(data || [])
    fetchTasks()
  }, [fetchTasks])

  useEffect(() => { load() }, [load])

  const requests = useMemo(() => tasks.filter((t) => t.type === 'request'), [tasks])

  const visible = useMemo(
    () => requests.filter((r) => {
      if (filters.status && r.status !== filters.status) return false
      if (filters.company && r.company_id !== filters.company) return false
      if (filters.priority && r.priority !== filters.priority) return false
      return true
    }).sort((a, b) => a.sort_order - b.sort_order),
    [requests, filters],
  )

  async function addRequest() {
    if (!newTitle.trim()) return
    const minOrder = Math.min(0, ...requests.map((r) => r.sort_order)) - 1
    const created = await addTask({
      title: newTitle.trim(),
      description: newDesc.trim() || null,
      type: 'request',
      company_id: newCompany || null,
      priority: newPriority,
      due_date: newDueDate || null,
      sort_order: minOrder,
    })
    if (!created) { toast('追加に失敗しました'); return }
    setNewTitle('')
    setNewDesc('')
    setNewDueDate('')
    setShowAdd(false)
    toast('追加しました')
  }

  async function toggleStatus(r: Task) {
    const newStatus = r.status === 'done' ? 'open' : 'done'
    const completed_at = newStatus === 'done' ? new Date().toISOString() : null
    await updateTask(r.id, { status: newStatus, completed_at })
    toast(newStatus === 'done' ? '完了しました' : '再オープンしました')
  }

  async function removeRequest(r: Task) {
    if (!confirm(`"${r.title}" を削除しますか？`)) return
    await deleteTask(r.id)
    toast('削除しました')
  }

  async function saveEdit() {
    if (!editing) return
    await updateTask(editing.id, {
      title: editing.title,
      description: editing.description,
      priority: editing.priority,
      status: editing.status,
      due_date: editing.due_date || null,
      company_id: editing.company_id || null,
    })
    toast('更新しました')
    setEditing(null)
  }

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

    const items = [...visible]
    const fromIdx = items.findIndex((r) => r.id === fromId)
    const toIdx = items.findIndex((r) => r.id === toId)
    if (fromIdx === -1 || toIdx === -1) return

    const [moved] = items.splice(fromIdx, 1)
    items.splice(toIdx, 0, moved)

    for (let i = 0; i < items.length; i++) {
      await updateTask(items[i].id, { sort_order: i })
    }
  }

  function handleDragEnd() {
    setDraggingId(null)
    setDragOverId(null)
  }

  if (loading && requests.length === 0) return <div className="page"><PageHeader title="Requests" /><SkeletonRows count={6} /></div>

  const todayStr = new Date().toISOString().substring(0, 10)

  return (
    <div className="page">
      <PageHeader
        title="Requests"
        description="部署・CLI への依頼キュー。ドラッグで優先順を変更"
        actions={
          <button className="btn btn-p btn-sm" onClick={() => setShowAdd(!showAdd)}>
            {showAdd ? '閉じる' : '+ リクエスト追加'}
          </button>
        }
      />

      {showAdd && (
        <div className="tasks-add-form card">
          <input
            className="input tasks-add-title"
            placeholder="依頼内容"
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
            <button className="btn btn-p" onClick={addRequest} disabled={!newTitle.trim()}>追加</button>
          </div>
        </div>
      )}

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

      <div className="card tasks-list">
        {visible.length === 0 ? (
          <EmptyState
            icon="↗"
            message="リクエストはありません"
            actionLabel="フィルターをリセット"
            onAction={() => setFilters({ status: '', company: '', priority: '' })}
          />
        ) : visible.map((r) => {
          const isDone = r.status === 'done'
          const isOverdue = r.due_date && r.due_date < todayStr && !isDone
          return (
            <div
              key={r.id}
              className={`tasks-row${isDone ? ' done' : ''}${isOverdue ? ' overdue' : ''}${draggingId === r.id ? ' dragging' : ''}${dragOverId === r.id ? ' drag-over' : ''}`}
              draggable
              onDragStart={() => handleDragStart(r.id)}
              onDragOver={(e) => handleDragOver(e, r.id)}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
            >
              <div className="tasks-drag-handle" title="ドラッグで並び替え">⠿</div>
              <button className={`tasks-check${isDone ? ' checked' : ''}`} onClick={() => toggleStatus(r)}>
                {isDone && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 3.5L3.5 6L9 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </button>
              <div className="tasks-content" onClick={() => setEditing({ ...r })}>
                <div className="tasks-title-row">
                  <span className={`tasks-title${isDone ? ' done' : ''}`}>{r.title}</span>
                  {isOverdue && <span className="tasks-overdue-badge">overdue</span>}
                </div>
                {r.description && <div className="tasks-desc">{r.description.substring(0, 140)}</div>}
                <div className="tasks-meta">
                  <span className="tasks-meta-item">{r.companies?.name || 'HD'}</span>
                  <span className={`tasks-priority tasks-priority--${r.priority}`}>{r.priority}</span>
                  {r.due_date && <span className="tasks-meta-item tasks-meta-date">{r.due_date}</span>}
                  <Tag variant={r.status as 'open' | 'done' | 'in_progress'}>{r.status}</Tag>
                </div>
              </div>
              <div className="tasks-actions">
                <button className="tasks-action-btn danger" onClick={() => removeRequest(r)}>削除</button>
              </div>
            </div>
          )
        })}
      </div>

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
                  <label className="form-label">会社</label>
                  <select className="input" value={editing.company_id || ''} onChange={(e) => setEditing({ ...editing, company_id: e.target.value || null })} style={{ width: '100%' }}>
                    <option value="">HD</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">優先度</label>
                  <select className="input" value={editing.priority} onChange={(e) => setEditing({ ...editing, priority: e.target.value as Task['priority'] })} style={{ width: '100%' }}>
                    <option value="high">High</option>
                    <option value="normal">Normal</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
              <div className="form-row" style={{ marginTop: 14 }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">ステータス</label>
                  <select className="input" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as Task['status'] })} style={{ width: '100%' }}>
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
