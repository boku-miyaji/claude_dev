import { create } from 'zustand'

interface BriefingStore {
  message: string | null
  loading: boolean
  lastFetched: string | null
  setMessage: (msg: string) => void
  setLoading: (loading: boolean) => void
  setLastFetched: (date: string) => void
  invalidate: () => void
}

export const useBriefingStore = create<BriefingStore>((set) => ({
  message: null,
  loading: false,
  lastFetched: null,

  setMessage: (msg) => set({ message: msg }),
  setLoading: (loading) => set({ loading }),
  setLastFetched: (date) => set({ lastFetched: date }),
  invalidate: () => set({ lastFetched: null, message: null }),
}))
