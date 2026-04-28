/**
 * Format a date to Japanese locale string (e.g., "2026/4/3")
 */
export function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('ja-JP')
}

/**
 * Format a datetime with month/day/hour/minute (e.g., "4/3 14:30")
 */
export function fmtTime(d: Date | string): string {
  const dt = new Date(d)
  return `${dt.getMonth() + 1}/${dt.getDate()} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
}

/**
 * Get date string in YYYY-MM-DD format (local timezone).
 *
 * NOTE: depends on the runtime's local TZ. Use `toJstDateStr` instead when
 * comparing values that originated as UTC ISO timestamps from the DB.
 */
export function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Convert a UTC ISO string or Date to a JST `YYYY-MM-DD` string.
 *
 * This is the canonical helper for habit / journal / task date comparisons.
 * Supabase stores `completed_at` / `created_at` / `deadline_at` as UTC, but
 * the app surfaces "today" in JST. Naïve `iso.substring(0, 10)` returns the
 * UTC date and miscategorises midnight-to-09:00 JST entries as the previous
 * day (the habit timezone bug fixed on 2026-04-28).
 *
 * Uses `en-CA` locale because it formats as `YYYY-MM-DD`.
 *
 * @param iso - ISO 8601 string (e.g. "2026-04-28T15:30:00Z") or Date instance.
 *              If it is already a date-only string ("YYYY-MM-DD" or longer),
 *              the first 10 chars are returned as-is to avoid TZ shifting a
 *              date column.
 */
export function toJstDateStr(iso: string | Date): string {
  if (typeof iso === 'string') {
    // Plain date-only column ("YYYY-MM-DD") — return verbatim to avoid TZ drift.
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  }
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
}

/**
 * Today's date in JST as `YYYY-MM-DD`.
 */
export function jstTodayStr(): string {
  return toJstDateStr(new Date())
}

/**
 * Format number as Japanese Yen
 */
export function fmtYen(n: number): string {
  return '¥' + n.toLocaleString('ja-JP')
}
