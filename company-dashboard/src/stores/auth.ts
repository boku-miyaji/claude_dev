import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthStore {
  user: User | null
  session: Session | null
  loading: boolean
  appReady: boolean
  accessDenied: boolean
  setSession: (session: Session | null) => void
  setAppReady: (ready: boolean) => void
  setAccessDenied: (denied: boolean) => void
  signInWithGithub: () => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  session: null,
  loading: true,
  appReady: false,
  accessDenied: false,

  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
      loading: false,
    }),

  setAppReady: (ready) => set({ appReady: ready }),
  setAccessDenied: (denied) => set({ accessDenied: denied }),

  signInWithGithub: async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: window.location.origin + window.location.pathname },
    })
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null, appReady: false, accessDenied: false })
  },
}))
