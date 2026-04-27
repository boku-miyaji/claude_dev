import { useEffect, useRef, useState } from 'react'
import { completeCalendarAuth, invalidateCalendarAuthCache } from '@/lib/calendarApi'

// Hard redirect instead of react-router navigate. Supabase's session restore
// and the Google OAuth flow both touch the URL during this page's lifecycle,
// which previously caused router-level navigation to silently no-op.
function goToCalendar() {
  window.location.replace('/calendar')
}

export function GoogleAuthCallback() {
  const [status, setStatus] = useState('Connecting Google Calendar...')
  const called = useRef(false)

  useEffect(() => {
    if (called.current) return
    called.current = true

    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')

    if (params.get('error')) {
      setStatus(`Google denied access: ${params.get('error')}`)
      setTimeout(goToCalendar, 3000)
      return
    }

    if (!code || state !== 'gcal_auth') {
      setStatus('Invalid callback parameters')
      setTimeout(goToCalendar, 3000)
      return
    }

    completeCalendarAuth(code)
      .then((result) => {
        invalidateCalendarAuthCache()
        if (result.ok) {
          goToCalendar()
        } else {
          console.error('[gcal-callback] Failed:', result.error)
          setStatus(`認証エラー: ${result.error}`)
          setTimeout(goToCalendar, 3000)
        }
      })
      .catch((err) => {
        console.error('[gcal-callback] Exception:', err)
        setStatus(`エラー: ${err.message}`)
        setTimeout(goToCalendar, 3000)
      })
  }, [])

  return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <p style={{ color: 'var(--text2)' }}>{status}</p>
    </div>
  )
}
