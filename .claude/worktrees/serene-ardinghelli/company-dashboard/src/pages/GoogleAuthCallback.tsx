import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { completeCalendarAuth, invalidateCalendarAuthCache } from '@/lib/calendarApi'

export function GoogleAuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('Connecting Google Calendar...')
  const called = useRef(false)

  useEffect(() => {
    // Prevent double call in React StrictMode
    if (called.current) return
    called.current = true

    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')

    if (params.get('error')) {
      setStatus(`Google denied access: ${params.get('error')}`)
      setTimeout(() => navigate('/calendar', { replace: true }), 3000)
      return
    }

    if (!code || state !== 'gcal_auth') {
      setStatus('Invalid callback parameters')
      setTimeout(() => navigate('/calendar', { replace: true }), 3000)
      return
    }

    completeCalendarAuth(code)
      .then((result) => {
        invalidateCalendarAuthCache()
        if (result.ok) {
          navigate('/calendar', { replace: true })
        } else {
          console.error('[gcal-callback] Failed:', result.error)
          setStatus(`認証エラー: ${result.error}`)
          setTimeout(() => navigate('/calendar', { replace: true }), 3000)
        }
      })
      .catch((err) => {
        console.error('[gcal-callback] Exception:', err)
        setStatus(`エラー: ${err.message}`)
        setTimeout(() => navigate('/calendar', { replace: true }), 3000)
      })
  }, [navigate])

  return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <p style={{ color: 'var(--text2)' }}>{status}</p>
    </div>
  )
}
