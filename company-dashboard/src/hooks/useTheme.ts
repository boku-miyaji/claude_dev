import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type ThemeValue = 'light' | 'dark' | 'system'

function applyTheme(theme: ThemeValue) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark)
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
}

export function useTheme() {
  useEffect(() => {
    let cancelled = false

    async function load() {
      // Read from claude_settings (synced by config-sync.sh on SessionStart)
      const { data } = await supabase
        .from('claude_settings')
        .select('settings_json')
        .order('updated_at', { ascending: false })
        .limit(5)

      if (cancelled) return

      let theme: ThemeValue = 'system'
      if (data) {
        for (const row of data) {
          const t = (row.settings_json as Record<string, unknown>)?.theme
          if (t === 'dark' || t === 'light' || t === 'system') {
            theme = t
            break
          }
        }
      }

      applyTheme(theme)

      // Persist for fast next load
      localStorage.setItem('dashboard-theme', theme)
    }

    // Apply stored theme immediately to avoid flash
    const stored = localStorage.getItem('dashboard-theme') as ThemeValue | null
    if (stored) applyTheme(stored)

    load()

    // Also react to system preference changes
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      const current = (localStorage.getItem('dashboard-theme') as ThemeValue) || 'system'
      if (current === 'system') applyTheme('system')
    }
    mq.addEventListener('change', handleChange)

    return () => {
      cancelled = true
      mq.removeEventListener('change', handleChange)
    }
  }, [])
}
