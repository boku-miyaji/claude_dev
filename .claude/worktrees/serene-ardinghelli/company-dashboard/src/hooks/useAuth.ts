import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

/**
 * Initializes auth state listener and ensures user_settings row exists.
 * Call once at the app root.
 */
export function useAuth() {
  const { setSession, setAppReady, setAccessDenied, appReady } = useAuthStore()

  useEffect(() => {
    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) ensureUserSettings(session.user.id, session.user.user_metadata)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        if (session && !appReady) {
          ensureUserSettings(session.user.id, session.user.user_metadata)
        }
        if (!session) {
          setAppReady(false)
          setAccessDenied(false)
        }
      },
    )

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function ensureUserSettings(userId: string, metadata: Record<string, unknown>) {
    const { data } = await supabase
      .from('user_settings')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (!data) {
      const { error } = await supabase.from('user_settings').insert({
        user_id: userId,
        github_username: (metadata.user_name as string) || '',
      })
      if (error) {
        setAccessDenied(true)
        return
      }
    }

    setAppReady(true)
  }
}
