import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PageHeader, EmptyState, Tag, SkeletonRows } from '@/components/ui'
import { toast } from '@/components/ui/Toast'
import { useDataStore } from '@/stores/data'
import type { Task, AttachmentMeta } from '@/types/tasks'
import {
  uploadRequestAttachment,
  deleteRequestAttachment,
  getRequestAttachmentUrl,
} from '@/lib/requestAttachments'
import { RequestAttachmentThumb } from '@/components/RequestAttachmentThumb'

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

  const [newPendingFiles, setNewPendingFiles] = useState<File[]>([])
  const [newPreviewUrls, setNewPreviewUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [editing, setEditing] = useState<Task | null>(null)
  const editFileInputRef = useRef<HTMLInputElement>(null)

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

  // --- Attachment helpers (add form) ---

  const acceptFiles = useCallback((files: FileList | File[]) => {
    const imgs = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (imgs.length === 0) return
    const previews = imgs.map((f) => URL.createObjectURL(f))
    setNewPendingFiles((prev) => [...prev, ...imgs])
    setNewPreviewUrls((prev) => [...prev, ...previews])
  }, [])

  function removePendingFile(idx: number) {
    setNewPendingFiles((prev) => prev.filter((_, i) => i !== idx))
    setNewPreviewUrls((prev) => {
      const url = prev[idx]
      if (url) URL.revokeObjectURL(url)
      return prev.filter((_, i) => i !== idx)
    })
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items
    if (!items) return
    const files: File[] = []
    for (const item of Array.from(items)) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const f = item.getAsFile()
        if (f) files.push(f)
      }
    }
    if (files.length > 0) {
      e.preventDefault()
      acceptFiles(files)
    }
  }

  function handleDropFiles(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      acceptFiles(e.dataTransfer.files)
    }
  }

  function resetAddForm() {
    newPreviewUrls.forEach((u) => URL.revokeObjectURL(u))
    setNewTitle('')
    setNewDesc('')
    setNewDueDate('')
    setNewPendingFiles([])
    setNewPreviewUrls([])
    setShowAdd(false)
  }

  async function addRequest() {
    if (!newTitle.trim() || uploading) return
    setUploading(true)
    try {
      let attachments: AttachmentMeta[] = []
      if (newPendingFiles.length > 0) {
        const results = await Promise.all(
          newPendingFiles.map((f, idx) => uploadRequestAttachment(f, idx).catch((err) => {
            toast(err?.message || 'アップロードに失敗しました')
            return null
          })),
        )
        attachments = results.filter((r): r is AttachmentMeta => r !== null)
        if (attachments.length < newPendingFiles.length) {
          toast(`${newPendingFiles.length - attachments.length}件のアップロードに失敗しました`)
        }
      }

      const minOrder = Math.min(0, ...requests.map((r) => r.sort_order)) - 1
      const created = await addTask({
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        type: 'request',
        company_id: newCompany || null,
        priority: newPriority,
        due_date: newDueDate || null,
        sort_order: minOrder,
        attachments,
      })
      if (!created) { toast('追加に失敗しました'); return }
      resetAddForm()
      toast('追加しました')
    } finally {
      setUploading(false)
    }
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
      attachments: editing.attachments ?? [],
    })
    toast('更新しました')
    setEditing(null)
  }

  async function addEditAttachments(files: FileList | File[]) {
    if (!editing) return
    const imgs = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (imgs.length === 0) return
    const baseIdx = (editing.attachments?.length ?? 0)
    const results = await Promise.all(
      imgs.map((f, i) => uploadRequestAttachment(f, baseIdx + i).catch((err) => {
        toast(err?.message || 'アップロードに失敗しました')
        return null
      })),
    )
    const added = results.filter((r): r is AttachmentMeta => r !== null)
    if (added.length === 0) return
    setEditing({ ...editing, attachments: [...(editing.attachments ?? []), ...added] })
  }

  async function removeEditAttachment(path: string) {
    if (!editing) return
    const ok = await deleteRequestAttachment(path)
    if (!ok) { toast('削除に失敗しました'); return }
    setEditing({
      ...editing,
      attachments: (editing.attachments ?? []).filter((a) => a.path !== path),
    })
  }

  async function openAttachmentInNewTab(path: string) {
    const url = await getRequestAttachmentUrl(path)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
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
        <div
          className="tasks-add-form card"
          onPaste={handlePaste}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDropFiles}
          style={dragActive ? { outline: '2px dashed var(--accent)', outlineOffset: -4 } : undefined}
        >
          <input
            className="input tasks-add-title"
            placeholder="依頼内容（Cmd+V でスクショ貼付可）"
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

          {newPreviewUrls.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              {newPreviewUrls.map((url, idx) => (
                <div key={idx} style={{ position: 'relative', width: 72, height: 72 }}>
                  <img
                    src={url}
                    alt=""
                    style={{
                      width: 72, height: 72, objectFit: 'cover', borderRadius: 6,
                      border: '1px solid var(--border)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => removePendingFile(idx)}
                    title="削除"
                    style={{
                      position: 'absolute', top: -6, right: -6, width: 18, height: 18,
                      borderRadius: '50%', border: '1px solid var(--border)',
                      background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer',
                      fontSize: 11, lineHeight: '16px', padding: 0,
                    }}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files) acceptFiles(e.target.files)
              e.target.value = ''
            }}
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
            <button
              type="button"
              className="btn btn-g btn-sm"
              onClick={() => fileInputRef.current?.click()}
              title="画像を添付（ペースト・ドロップも可）"
            >
              画像添付
            </button>
            <button className="btn btn-p" onClick={addRequest} disabled={!newTitle.trim() || uploading}>
              {uploading ? '追加中…' : '追加'}
            </button>
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
                  {r.attachments && r.attachments.length > 0 && (
                    <span
                      title={`${r.attachments.length}件の添付`}
                      style={{
                        fontSize: 12, color: 'var(--text-dim)',
                        display: 'inline-flex', alignItems: 'center', gap: 2,
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                      </svg>
                      {r.attachments.length}
                    </span>
                  )}
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

              <div style={{ marginTop: 18 }}>
                <label className="form-label">添付画像</label>
                <div
                  style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}
                  onPaste={(e) => {
                    const items = e.clipboardData?.items
                    if (!items) return
                    const files: File[] = []
                    for (const item of Array.from(items)) {
                      if (item.kind === 'file' && item.type.startsWith('image/')) {
                        const f = item.getAsFile()
                        if (f) files.push(f)
                      }
                    }
                    if (files.length > 0) {
                      e.preventDefault()
                      addEditAttachments(files)
                    }
                  }}
                >
                  {(editing.attachments ?? []).map((a) => (
                    <RequestAttachmentThumb
                      key={a.path}
                      path={a.path}
                      size={72}
                      alt={a.name}
                      onClick={() => openAttachmentInNewTab(a.path)}
                      onRemove={() => removeEditAttachment(a.path)}
                    />
                  ))}
                  <input
                    ref={editFileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files) addEditAttachments(e.target.files)
                      e.target.value = ''
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-g btn-sm"
                    onClick={() => editFileInputRef.current?.click()}
                  >
                    + 追加
                  </button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
                  クリックで拡大 / Cmd+V で貼り付け / 5MB以下の画像
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
