import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { DiaryEntry, EmotionAnalysis } from '@/types/diary'
import type { Task, AttachmentMeta } from '@/types/tasks'
import { syncTaskToGoogle, syncTaskComplete, syncTaskReopen } from '@/lib/googleTasksApi'
import type { Dream } from '@/types/dreams'
import type { Goal } from '@/types/goals'
import type { Habit, HabitLog } from '@/types/habits'
import type { Idea } from '@/types/ideas'
import { toJstDateStr } from '@/lib/date'

/** Cache TTL in milliseconds (5 minutes) */
const CACHE_TTL = 5 * 60 * 1000

interface DataStore {
  // --- Data ---
  diaryEntries: DiaryEntry[]
  emotionAnalyses: EmotionAnalysis[]
  tasks: Task[]
  dreams: Dream[]
  goals: Goal[]
  habits: Habit[]
  habitLogs: HabitLog[]
  ideas: Idea[]
  apiKey: string | null
  apiKeyFetched: boolean

  // --- Loading states ---
  loading: Record<string, boolean>

  // --- Last fetched timestamps (for cache invalidation) ---
  lastFetched: Record<string, number>

  // --- Actions: Fetch ---
  fetchDiary: (options?: { days?: number; forceRefresh?: boolean }) => Promise<void>
  fetchEmotions: (options?: { days?: number; forceRefresh?: boolean }) => Promise<void>
  fetchTasks: (options?: { forceRefresh?: boolean }) => Promise<void>
  fetchDreams: (options?: { forceRefresh?: boolean }) => Promise<void>
  fetchGoals: (options?: { forceRefresh?: boolean }) => Promise<void>
  fetchHabits: (options?: { forceRefresh?: boolean }) => Promise<void>
  fetchHabitLogs: (options?: { days?: number; forceRefresh?: boolean }) => Promise<void>
  fetchIdeas: (options?: { forceRefresh?: boolean }) => Promise<void>
  fetchApiKey: () => Promise<string | null>

  // --- Actions: Mutations ---
  addDiaryEntry: (entry: { body: string; entry_type?: string; entry_date?: string; image_urls?: string[] }) => Promise<DiaryEntry | null>
  addDream: (dream: Partial<Dream>) => Promise<Dream | null>
  updateDream: (id: string, data: Partial<Dream>) => Promise<void>
  deleteDream: (id: string) => Promise<void>
  addGoal: (goal: Record<string, unknown>) => Promise<Goal | null>
  updateGoal: (id: string, data: Record<string, unknown>) => Promise<void>
  deleteGoal: (id: string) => Promise<void>
  addTask: (task: {
    title: string
    description?: string | null
    type?: string | null
    priority?: string
    company_id?: string | null
    due_date?: string | null
    scheduled_at?: string | null
    deadline_at?: string | null
    estimated_minutes?: number | null
    time_slot?: string | null
    sort_order?: number
    progress_pct?: number | null
    attachments?: AttachmentMeta[] | null
    source?: string | null
  }) => Promise<Task | null>
  updateTask: (id: string, data: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  addHabit: (habit: Partial<Habit>) => Promise<Habit | null>
  updateHabit: (id: number, data: Partial<Habit>) => Promise<void>
  deleteHabit: (id: number) => Promise<void>
  toggleHabitLog: (habit: Habit, todayStr: string) => Promise<void>
  addIdea: (idea: Partial<Idea>) => Promise<Idea | null>
  updateIdea: (id: string, data: Partial<Idea>) => Promise<void>
  deleteIdea: (id: string) => Promise<void>

  // --- Invalidation ---
  invalidate: (key: string) => void
  invalidateAll: () => void
}

/**
 * Check if cached data is still fresh.
 */
function isFresh(lastFetched: Record<string, number>, key: string): boolean {
  const t = lastFetched[key]
  if (!t) return false
  return Date.now() - t < CACHE_TTL
}

export const useDataStore = create<DataStore>((set, get) => ({
  // --- Initial state ---
  diaryEntries: [],
  emotionAnalyses: [],
  tasks: [],
  dreams: [],
  goals: [],
  habits: [],
  habitLogs: [],
  ideas: [],
  apiKey: null,
  apiKeyFetched: false,
  loading: {},
  lastFetched: {},

  // --- Fetch actions ---

  fetchDiary: async (options) => {
    const { forceRefresh = false, days = 30 } = options ?? {}
    const key = `diary-${days}`
    if (!forceRefresh && isFresh(get().lastFetched, key)) return

    set((s) => ({ loading: { ...s.loading, diary: true } }))

    const since = new Date()
    since.setDate(since.getDate() - days)

    const { data } = await supabase
      .from('diary_entries')
      .select('*')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })

    set((s) => ({
      diaryEntries: (data as DiaryEntry[]) ?? [],
      loading: { ...s.loading, diary: false },
      lastFetched: { ...s.lastFetched, [key]: Date.now() },
    }))
  },

  fetchEmotions: async (options) => {
    const { forceRefresh = false, days = 30 } = options ?? {}
    const key = `emotions-${days}`
    if (!forceRefresh && isFresh(get().lastFetched, key)) return

    set((s) => ({ loading: { ...s.loading, emotions: true } }))

    const since = new Date()
    since.setDate(since.getDate() - days)

    const { data } = await supabase
      .from('emotion_analysis')
      .select('*')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })

    set((s) => ({
      emotionAnalyses: (data as EmotionAnalysis[]) ?? [],
      loading: { ...s.loading, emotions: false },
      lastFetched: { ...s.lastFetched, [key]: Date.now() },
    }))
  },

  fetchTasks: async (options) => {
    const { forceRefresh = false } = options ?? {}
    if (!forceRefresh && isFresh(get().lastFetched, 'tasks')) return

    set((s) => ({ loading: { ...s.loading, tasks: true } }))

    const { data } = await supabase
      .from('tasks')
      .select('*, companies(name)')
      .order('created_at', { ascending: false })

    set((s) => ({
      tasks: (data as Task[]) ?? [],
      loading: { ...s.loading, tasks: false },
      lastFetched: { ...s.lastFetched, tasks: Date.now() },
    }))
  },

  fetchDreams: async (options) => {
    const { forceRefresh = false } = options ?? {}
    if (!forceRefresh && isFresh(get().lastFetched, 'dreams')) return

    set((s) => ({ loading: { ...s.loading, dreams: true } }))

    const { data } = await supabase
      .from('dreams')
      .select('*')
      .order('created_at', { ascending: false })

    set((s) => ({
      dreams: (data as Dream[]) ?? [],
      loading: { ...s.loading, dreams: false },
      lastFetched: { ...s.lastFetched, dreams: Date.now() },
    }))
  },

  fetchIdeas: async (options) => {
    const { forceRefresh = false } = options ?? {}
    if (!forceRefresh && isFresh(get().lastFetched, 'ideas')) return

    set((s) => ({ loading: { ...s.loading, ideas: true } }))

    const { data } = await supabase
      .from('ideas')
      .select('*')
      .order('created_at', { ascending: false })

    set((s) => ({
      ideas: (data as Idea[]) ?? [],
      loading: { ...s.loading, ideas: false },
      lastFetched: { ...s.lastFetched, ideas: Date.now() },
    }))
  },

  fetchGoals: async (options) => {
    const { forceRefresh = false } = options ?? {}
    if (!forceRefresh && isFresh(get().lastFetched, 'goals')) return

    set((s) => ({ loading: { ...s.loading, goals: true } }))

    const { data } = await supabase
      .from('goals')
      .select('*')
      .order('created_at', { ascending: false })

    set((s) => ({
      goals: (data as Goal[]) ?? [],
      loading: { ...s.loading, goals: false },
      lastFetched: { ...s.lastFetched, goals: Date.now() },
    }))
  },

  fetchHabits: async (options) => {
    const { forceRefresh = false } = options ?? {}
    if (!forceRefresh && isFresh(get().lastFetched, 'habits')) return

    set((s) => ({ loading: { ...s.loading, habits: true } }))

    const { data } = await supabase
      .from('habits')
      .select('*')
      .eq('active', true)
      .order('created_at')

    set((s) => ({
      habits: (data as Habit[]) ?? [],
      loading: { ...s.loading, habits: false },
      lastFetched: { ...s.lastFetched, habits: Date.now() },
    }))
  },

  fetchHabitLogs: async (options) => {
    const { forceRefresh = false, days = 30 } = options ?? {}
    const key = `habitLogs-${days}`
    if (!forceRefresh && isFresh(get().lastFetched, key)) return

    set((s) => ({ loading: { ...s.loading, habitLogs: true } }))

    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceStr = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, '0')}-${String(since.getDate()).padStart(2, '0')}T00:00:00`

    const { data } = await supabase
      .from('habit_logs')
      .select('*')
      .gte('completed_at', sinceStr)
      .order('completed_at', { ascending: false })

    set((s) => ({
      habitLogs: (data as HabitLog[]) ?? [],
      loading: { ...s.loading, habitLogs: false },
      lastFetched: { ...s.lastFetched, [key]: Date.now() },
    }))
  },

  fetchApiKey: async () => {
    const state = get()
    if (state.apiKeyFetched) return state.apiKey

    const { data } = await supabase
      .from('user_settings')
      .select('openai_api_key')
      .single()

    const key = data?.openai_api_key ?? null
    set({ apiKey: key, apiKeyFetched: true })
    return key
  },

  // --- Mutation actions ---

  addDiaryEntry: async (entry) => {
    const { data } = await supabase
      .from('diary_entries')
      .insert({
        body: entry.body.trim(),
        entry_type: entry.entry_type ?? 'fragment',
        entry_date: entry.entry_date ?? null,
        image_urls: entry.image_urls && entry.image_urls.length > 0 ? entry.image_urls : null,
      })
      .select()
      .single()

    if (data) {
      const newEntry = data as DiaryEntry
      set((s) => ({ diaryEntries: [newEntry, ...s.diaryEntries] }))
      return newEntry
    }
    return null
  },

  addDream: async (dream) => {
    const { data, error } = await supabase
      .from('dreams')
      .insert(dream)
      .select()
      .single()
    if (error || !data) return null
    const newDream = data as Dream
    set((s) => ({ dreams: [newDream, ...s.dreams] }))
    return newDream
  },

  updateDream: async (id, updates) => {
    const { error } = await supabase
      .from('dreams')
      .update(updates)
      .eq('id', id)
    if (!error) {
      set((s) => ({
        dreams: s.dreams.map((d) => (d.id === id ? { ...d, ...updates } : d)),
      }))
    }
  },

  deleteDream: async (id) => {
    const { error } = await supabase.from('dreams').delete().eq('id', id)
    if (!error) {
      set((s) => ({ dreams: s.dreams.filter((d) => d.id !== id) }))
    }
  },

  addGoal: async (goal) => {
    const { data, error } = await supabase
      .from('goals')
      .insert(goal)
      .select()
      .single()
    if (error || !data) return null
    const newGoal = data as Goal
    set((s) => ({ goals: [newGoal, ...s.goals] }))
    return newGoal
  },

  updateGoal: async (id, updates) => {
    const { error } = await supabase
      .from('goals')
      .update(updates)
      .eq('id', id)
    if (!error) {
      set((s) => ({
        goals: s.goals.map((g) => (g.id === id ? { ...g, ...updates } as Goal : g)),
      }))
    }
  },

  deleteGoal: async (id) => {
    const { error } = await supabase.from('goals').delete().eq('id', id)
    if (!error) {
      set((s) => ({ goals: s.goals.filter((g) => g.id !== id) }))
    }
  },

  addTask: async (task) => {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title: task.title,
        description: task.description ?? null,
        type: task.type ?? 'task',
        priority: task.priority ?? 'normal',
        company_id: task.company_id ?? null,
        due_date: task.due_date ?? null,
        scheduled_at: task.scheduled_at ?? null,
        deadline_at: task.deadline_at ?? null,
        estimated_minutes: task.estimated_minutes ?? null,
        time_slot: task.time_slot ?? null,
        sort_order: task.sort_order ?? 0,
        progress_pct: task.progress_pct ?? null,
        status: 'open',
        attachments: task.attachments ?? [],
        source: task.source ?? null,
      })
      .select('*, companies(name)')
      .single()
    if (error || !data) return null
    const newTask = data as Task
    set((s) => ({ tasks: [newTask, ...s.tasks] }))

    // Sync to Google Tasks (async, non-blocking)
    syncTaskToGoogle(newTask).then((googleTaskId) => {
      if (googleTaskId && !newTask.google_task_id) {
        supabase.from('tasks').update({ google_task_id: googleTaskId }).eq('id', newTask.id).then(() => {
          set((s) => ({
            tasks: s.tasks.map((t) => t.id === newTask.id ? { ...t, google_task_id: googleTaskId } : t),
          }))
        })
      }
    })

    return newTask
  },

  updateTask: async (id, updates) => {
    const { error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
    if (!error) {
      const prev = get().tasks.find((t) => t.id === id)
      const merged = prev ? { ...prev, ...updates } as Task : null
      set((s) => ({
        tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...updates } as Task : t)),
      }))

      // Sync to Google Tasks (async, non-blocking)
      if (merged?.google_task_id) {
        if (updates.status === 'done') {
          syncTaskComplete(merged.google_task_id)
        } else if (updates.status === 'open' && prev?.status === 'done') {
          syncTaskReopen(merged.google_task_id)
        } else if (updates.title || updates.due_date || updates.scheduled_at || updates.deadline_at) {
          syncTaskToGoogle(merged)
        }
      } else if (merged && !merged.google_task_id && (updates.due_date || updates.scheduled_at || updates.deadline_at)) {
        // Task just got a date — create in Google Tasks
        syncTaskToGoogle(merged).then((googleTaskId) => {
          if (googleTaskId) {
            supabase.from('tasks').update({ google_task_id: googleTaskId }).eq('id', id).then(() => {
              set((s) => ({
                tasks: s.tasks.map((t) => t.id === id ? { ...t, google_task_id: googleTaskId } : t),
              }))
            })
          }
        })
      }
    }
  },

  deleteTask: async (id) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (!error) {
      set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }))
    }
  },

  addHabit: async (habit) => {
    const { data, error } = await supabase
      .from('habits')
      .insert(habit)
      .select()
      .single()
    if (error || !data) return null
    const newHabit = data as Habit
    set((s) => ({ habits: [...s.habits, newHabit] }))
    return newHabit
  },

  updateHabit: async (id, updates) => {
    const { error } = await supabase
      .from('habits')
      .update(updates)
      .eq('id', id)
    if (!error) {
      set((s) => ({
        habits: s.habits.map((h) => (h.id === id ? { ...h, ...updates } : h)),
      }))
    }
  },

  deleteHabit: async (id) => {
    // Soft delete: set active=false
    const { error } = await supabase
      .from('habits')
      .update({ active: false })
      .eq('id', id)
    if (!error) {
      set((s) => ({ habits: s.habits.filter((h) => h.id !== id) }))
    }
  },

  addIdea: async (idea) => {
    const { data, error } = await supabase
      .from('ideas')
      .insert(idea)
      .select()
      .single()
    if (error || !data) return null
    const newIdea = data as Idea
    set((s) => ({ ideas: [newIdea, ...s.ideas] }))
    return newIdea
  },

  updateIdea: async (id, updates) => {
    const { error } = await supabase
      .from('ideas')
      .update(updates)
      .eq('id', id)
    if (!error) {
      set((s) => ({
        ideas: s.ideas.map((i) => (i.id === id ? { ...i, ...updates } as Idea : i)),
      }))
    }
  },

  deleteIdea: async (id) => {
    const { error } = await supabase.from('ideas').delete().eq('id', id)
    if (!error) {
      set((s) => ({ ideas: s.ideas.filter((i) => i.id !== id) }))
    }
  },

  toggleHabitLog: async (habit, todayStr) => {
    const state = get()
    const todayLogged = state.habitLogs.some(
      (l) => l.habit_id === habit.id && toJstDateStr(l.completed_at) === todayStr,
    )

    if (todayLogged) {
      // Uncomplete: remove today's log
      const todayLog = state.habitLogs.find(
        (l) => l.habit_id === habit.id && toJstDateStr(l.completed_at) === todayStr,
      )
      if (todayLog) {
        await supabase.from('habit_logs').delete().eq('id', todayLog.id)
        set((s) => ({ habitLogs: s.habitLogs.filter((l) => l.id !== todayLog.id) }))
      }
    } else {
      // Complete: add log for today
      const { data } = await supabase
        .from('habit_logs')
        .insert({ habit_id: habit.id })
        .select()
        .single()
      if (data) {
        set((s) => ({ habitLogs: [data as HabitLog, ...s.habitLogs] }))
      }
    }
  },

  // --- Invalidation ---

  invalidate: (key) => {
    set((s) => {
      const newLastFetched = { ...s.lastFetched }
      // Remove all keys starting with the given key prefix
      for (const k of Object.keys(newLastFetched)) {
        if (k === key || k.startsWith(`${key}-`)) {
          delete newLastFetched[k]
        }
      }
      return { lastFetched: newLastFetched }
    })
  },

  invalidateAll: () => {
    set({ lastFetched: {} })
  },
}))
