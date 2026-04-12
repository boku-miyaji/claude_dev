import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { completeCalendarAuth, invalidateCalendarAuthCache } from '@/lib/calendarApi'

/**
 * Google OAuth callback page.
 * Google redirects here with ?code=... after user grants consent.
 * We send the code to the Edge Function to exchange for tokens.
 */
export function GoogleAuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    const errorParam = params.get('error')

    if (errorParam) {
      setError(`Google denied access: ${errorParam}`)
      return
    }

    if (!code || state !== 'gcal_auth') {
      setError('Invalid callback parameters')
      return
    }

    let completed = false

    function doComplete() {
      if (completed) return
      completed = true
      completeCalendarAuth(code!).then((result) => {
        if (result.ok) {
          invalidateCalendarAuthCache()
          navigate('/calendar', { replace: true })
        } else {
          setError(result.error || 'Failed to complete authentication')
        }
      })
    }

    // Wait for Supabase session to be restored after page redirect
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) return
      subscription.unsubscribe()
      doComplete()
    })

    // Also try immediately in case session is already restored
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        subscription.unsubscribe()
        doComplete()
      }
    })

    return () => { subscription.unsubscribe() }
  }, [navigate])

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2 style={{ color: 'var(--text)', marginBottom: 12 }}>Authentication Error</h2>
        <p style={{ color: 'var(--text2)', marginBottom: 20 }}>{error}</p>
        <button className="btn btn-p" onClick={() => navigate('/calendar')}>
          Back to Calendar
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <p style={{ color: 'var(--text2)' }}>Connecting Google Calendar...</p>
    </div>
  )
}
