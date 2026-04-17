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
 * Get date string in YYYY-MM-DD format (local timezone)
 */
export function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Format number as Japanese Yen
 */
export function fmtYen(n: number): string {
  return '¥' + n.toLocaleString('ja-JP')
}
