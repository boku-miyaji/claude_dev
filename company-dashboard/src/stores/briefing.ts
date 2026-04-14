import { create } from 'zustand'

/** Snapshot of what the AI Partner was given when it generated `message`.
 *  Used by the feedback UI so 👍/違う buttons can attach the real context. */
export interface BriefingContextSnapshot {
  time_mode: string
  diary: string | null
  generated_at: string
}

interface BriefingStore {
  message: string | null
  loading: boolean
  lastFetched: string | null
  contextSnapshot: BriefingContextSnapshot | null
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

  setMessage: (msg, snapshot) => set({ message: msg, contextSnapshot: snapshot ?? null }),
  setLoading: (loading) => set({ loading }),
  setLastFetched: (date) => set({ lastFetched: date }),
  invalidate: () => set({ lastFetched: null, message: null, contextSnapshot: null }),
}))
