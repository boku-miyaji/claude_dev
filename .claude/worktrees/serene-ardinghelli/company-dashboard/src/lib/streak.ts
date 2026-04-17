import { supabase } from '@/lib/supabase'

/**
 * Calculate the current diary writing streak (consecutive days).
 * Looks back up to 90 days from today.
 */
export async function calculateStreak(): Promise<number> {
  const { data } = await supabase
    .from('diary_entries')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(90)

  if (!data || data.length === 0) return 0

  const dates = new Set(
    data.map((e: { created_at: string }) => e.created_at.substring(0, 10)),
  )

  const d = new Date()
  const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  let streak = 0

  if (dates.has(todayStr)) {
    streak = 1
  } else {
    d.setDate(d.getDate() - 1)
  }

  for (let i = 0; i < 90; i++) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (dates.has(key)) {
      if (streak === 0) streak = 1
      else streak++
      d.setDate(d.getDate() - 1)
    } else {
      break
    }
  }

  return streak
}
