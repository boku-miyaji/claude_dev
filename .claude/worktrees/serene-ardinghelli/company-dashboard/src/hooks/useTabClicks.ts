import { useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useNavigationStore } from '@/stores/navigation'
import { NAV_ITEMS } from '@/lib/constants'
import type { NavItem } from '@/types/common'

export function useTabClicks() {
  const { tabClickCounts, setTabClickCounts, recordClick } = useNavigationStore()

  // Load click counts from Supabase on mount
  useEffect(() => {
    async function load() {
      // Query tab_clicks for frequency data
      const { data: clicks } = await supabase.from('tab_clicks').select('page')
      if (clicks) {
        const counts: Record<string, number> = {}
        clicks.forEach((c: { page: string }) => { counts[c.page] = (counts[c.page] || 0) + 1 })
        setTabClickCounts(counts)
      }
    }
    load()
  }, [setTabClickCounts])

  const record = useCallback((page: string) => {
    recordClick(page)
    // Fire and forget
    supabase.from('tab_clicks').insert({ page }).then(() => {})
  }, [recordClick])

  // Return tabs sorted by frequency
  const orderedTabs: NavItem[] = [...NAV_ITEMS].sort((a, b) => {
    const ca = tabClickCounts[a.page] || 0
    const cb = tabClickCounts[b.page] || 0
    return cb - ca
  })

  return { record, orderedTabs }
}
