import { create } from 'zustand'

/** Snapshot of what the AI Partner was given when it generated `message`.
 *  Used by the feedback UI so 👍/違う buttons can attach the real context. */
export interface BriefingContextSnapshot {
  time_mode: string
  diary: string | null
  generated_at: string
}

const RECENT_HISTORY_LIMIT = 3

interface BriefingStore {
  message: string | null
  loading: boolean
  lastFetched: string | null
  contextSnapshot: BriefingContextSnapshot | null
  /** Last N generated messages (most recent first). Used to avoid repetition in prompts. */
  recentMessages: string[]
  setMessage: (msg: string, snapshot?: BriefingContextSnapshot) => void
  setLoading: (loading: boolean) => void
  setLastFetched: (date: string) => void
  invalidate: () => void
}

export const useBriefingStore = create<BriefingStore>((set) => ({
  message: null,
  loading: false,
  lastFetched: null,
  contextSnapshot: null,
  recentMessages: [],

  setMessage: (msg, snapshot) => set((s) => {
    const nextHistory = msg && msg !== s.message
      ? [msg, ...s.recentMessages.filter((m) => m !== msg)].slice(0, RECENT_HISTORY_LIMIT)
      : s.recentMessages
    return { message: msg, contextSnapshot: snapshot ?? null, recentMessages: nextHistory }
  }),
  setLoading: (loading) => set({ loading }),
  setLastFetched: (date) => set({ lastFetched: date }),
  invalidate: () => set({ lastFetched: null, message: null, contextSnapshot: null }),
}))
