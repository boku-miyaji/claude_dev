import { create } from 'zustand'

interface NavigationStore {
  tabClickCounts: Record<string, number>
  setTabClickCounts: (counts: Record<string, number>) => void
  recordClick: (page: string) => void
}

export const useNavigationStore = create<NavigationStore>((set) => ({
  tabClickCounts: {},

  setTabClickCounts: (counts) => set({ tabClickCounts: counts }),

  recordClick: (page) =>
    set((state) => ({
      tabClickCounts: {
        ...state.tabClickCounts,
        [page]: (state.tabClickCounts[page] || 0) + 1,
      },
    })),
}))
