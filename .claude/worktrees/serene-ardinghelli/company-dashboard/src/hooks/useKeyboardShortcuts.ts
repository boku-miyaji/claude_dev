import { useEffect, useCallback, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { NAV_SHORTCUTS, isTyping } from '@/lib/shortcuts'

/**
 * Global keyboard shortcuts — mounted once at App level.
 * Handles navigation (Cmd+1〜9), sidebar toggle (Cmd+Shift+S), and shortcut help (Cmd+/).
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate()
  const location = useLocation()
  const [showHelp, setShowHelp] = useState(false)

  const handler = useCallback((e: KeyboardEvent) => {
    const meta = e.metaKey || e.ctrlKey

    // ── Cmd+/ → Toggle shortcut help ──
    if (meta && e.key === '/') {
      e.preventDefault()
      setShowHelp((v) => !v)
      return
    }

    // ── Escape → Close help, or let page handle it ──
    if (e.key === 'Escape' && showHelp) {
      setShowHelp(false)
      return
    }

    // ── Cmd+Shift+S → Toggle sidebar ──
    if (meta && e.shiftKey && e.key.toLowerCase() === 's') {
      e.preventDefault()
      window.dispatchEvent(new CustomEvent('shortcut:toggle-sidebar'))
      return
    }

    // ── Cmd+1〜9 → Page navigation ──
    if (meta && !e.shiftKey && e.key >= '1' && e.key <= '9') {
      const idx = parseInt(e.key) - 1
      if (idx < NAV_SHORTCUTS.length) {
        e.preventDefault()
        navigate(NAV_SHORTCUTS[idx])
        return
      }
    }

    // ── Page-specific shortcuts via custom events ──
    // Today: Cmd+Shift+T (add task), Cmd+Shift+D (diary focus)
    if (meta && e.shiftKey && location.pathname === '/') {
      if (e.key.toLowerCase() === 't') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('shortcut:add-task'))
        return
      }
      if (e.key.toLowerCase() === 'd') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('shortcut:focus-diary'))
        return
      }
    }

    // Calendar: single-key shortcuts (only when not typing)
    if (location.pathname === '/calendar' && !isTyping()) {
      if (e.key === 'ArrowLeft') {
        window.dispatchEvent(new CustomEvent('shortcut:calendar-prev'))
        return
      }
      if (e.key === 'ArrowRight') {
        window.dispatchEvent(new CustomEvent('shortcut:calendar-next'))
        return
      }
      if (e.key.toLowerCase() === 't') {
        window.dispatchEvent(new CustomEvent('shortcut:calendar-today'))
        return
      }
    }
    // Calendar: Cmd+Shift+N (new event)
    if (meta && e.shiftKey && e.key.toLowerCase() === 'n' && location.pathname === '/calendar') {
      e.preventDefault()
      window.dispatchEvent(new CustomEvent('shortcut:calendar-new-event'))
      return
    }
  }, [navigate, location.pathname, showHelp])

  useEffect(() => {
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [handler])

  return { showHelp, setShowHelp }
}
