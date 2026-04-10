import { supabase } from '@/lib/supabase'

const PROXY_BASE = import.meta.env.VITE_SUPABASE_URL + '/functions/v1/google-calendar-proxy'

export interface GoogleTask {
  id: string
  title: string
  notes: string | null
  due: string | null       // RFC 3339 datetime
  status: 'needsAction' | 'completed'
  completed: string | null // RFC 3339 datetime
  updated: string
  position: string
  parent: string | null
}

export interface GoogleTaskList {
  id: string
  title: string
  updated: string
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token || ''
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
  }
}

/** Fetch Google Task lists */
export async function fetchTaskLists(): Promise<GoogleTaskList[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${PROXY_BASE}/tasks/lists`, { headers })
  if (res.status === 401) throw new Error('NEEDS_AUTH')
  if (!res.ok) throw new Error(`Tasks API error: ${res.status}`)
  const data = await res.json()
  return data.items || []
}

/** Fetch Google Tasks with optional date filter */
export async function fetchGoogleTasks(options?: {
  taskListId?: string
  dueMin?: string
  dueMax?: string
  showCompleted?: boolean
}): Promise<GoogleTask[]> {
  const headers = await getAuthHeaders()
  const params = new URLSearchParams()
  if (options?.taskListId) params.set('task_list_id', options.taskListId)
  if (options?.dueMin) params.set('due_min', options.dueMin)
  if (options?.dueMax) params.set('due_max', options.dueMax)
  if (options?.showCompleted !== undefined) params.set('show_completed', String(options.showCompleted))

  const res = await fetch(`${PROXY_BASE}/tasks?${params}`, { headers })
  if (res.status === 401) throw new Error('NEEDS_AUTH')
  if (!res.ok) throw new Error(`Tasks API error: ${res.status}`)
  const data = await res.json()
  return data.tasks || []
}

/** Create a Google Task */
export async function createGoogleTask(task: {
  title: string
  notes?: string
  due?: string  // RFC 3339
}, taskListId?: string): Promise<GoogleTask> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${PROXY_BASE}/tasks`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      task_list_id: taskListId || '@default',
      task,
    }),
  })
  if (!res.ok) throw new Error(`Create task failed: ${res.status}`)
  return res.json()
}

/** Update a Google Task (e.g. mark complete) */
export async function updateGoogleTask(
  taskId: string,
  patch: Partial<{ title: string; notes: string; due: string; status: string }>,
  taskListId?: string,
): Promise<GoogleTask> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${PROXY_BASE}/tasks`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      task_list_id: taskListId || '@default',
      task_id: taskId,
      patch,
    }),
  })
  if (!res.ok) throw new Error(`Update task failed: ${res.status}`)
  return res.json()
}

/** Delete a Google Task */
export async function deleteGoogleTask(taskId: string, taskListId?: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${PROXY_BASE}/tasks`, {
    method: 'DELETE',
    headers,
    body: JSON.stringify({
      task_list_id: taskListId || '@default',
      task_id: taskId,
    }),
  })
  if (!res.ok) throw new Error(`Delete task failed: ${res.status}`)
}
