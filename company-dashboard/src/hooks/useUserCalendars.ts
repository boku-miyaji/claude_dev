import { useEffect, useState } from 'react'
import { fetchUserCalendars, type UserCalendar } from '@/lib/calendarApi'

export type { UserCalendar }

/**
 * ログイン中ユーザーが書き込めるカレンダー一覧を Google calendarList から取得する。
 *
 * design notes:
 * - メアドハードコード (旧 GCAL_CALENDARS) をやめてマルチアカウント対応の入口にする hook。
 * - 一度取れたら session 中はキャッシュする (load on mount)。
 * - 未認証 (NEEDS_AUTH) のときは空配列を返す（呼び出し側で auth flow に誘導される想定）。
 * - 失敗時はエラーを返すが、UI は空配列で動けるよう loading/error 切り分け可能。
 */
export function useUserCalendars(): {
  calendars: UserCalendar[]
  loading: boolean
  error: string | null
  primary: UserCalendar | null
  reload: () => void
} {
  const [calendars, setCalendars] = useState<UserCalendar[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchUserCalendars()
      .then((cals) => { if (!cancelled) setCalendars(cals) })
      .catch((err) => { if (!cancelled) setError(err.message || 'failed') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [reloadKey])

  const primary = calendars.find((c) => c.primary) || null

  return { calendars, loading, error, primary, reload: () => setReloadKey((k) => k + 1) }
}
