import { describe, it, expect } from 'vitest'
import { toJstDateStr, jstTodayStr, toLocalDateStr } from '../date'

describe('toJstDateStr', () => {
  it('treats UTC 23:59 as the next-day in JST', () => {
    // 2026-04-28T23:59:00Z = 2026-04-29 08:59 JST
    expect(toJstDateStr('2026-04-28T23:59:00Z')).toBe('2026-04-29')
  })

  it('treats UTC 00:01 as the same JST day (already +9h)', () => {
    // 2026-04-28T00:01:00Z = 2026-04-28 09:01 JST
    expect(toJstDateStr('2026-04-28T00:01:00Z')).toBe('2026-04-28')
  })

  it('handles the JST midnight boundary correctly', () => {
    // 2026-04-27T15:00:00Z = 2026-04-28 00:00 JST (start of new JST day)
    expect(toJstDateStr('2026-04-27T15:00:00Z')).toBe('2026-04-28')
    // 2026-04-27T14:59:00Z = 2026-04-27 23:59 JST (still previous JST day)
    expect(toJstDateStr('2026-04-27T14:59:00Z')).toBe('2026-04-27')
  })

  it('accepts a Date instance', () => {
    expect(toJstDateStr(new Date('2026-04-28T23:59:00Z'))).toBe('2026-04-29')
  })

  it('returns plain date-only strings verbatim (no TZ drift)', () => {
    expect(toJstDateStr('2026-04-28')).toBe('2026-04-28')
  })

  it('produces YYYY-MM-DD format', () => {
    expect(toJstDateStr('2026-01-05T03:00:00Z')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('jstTodayStr', () => {
  it('returns a YYYY-MM-DD string', () => {
    expect(jstTodayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('toLocalDateStr', () => {
  it('returns a YYYY-MM-DD string from a Date', () => {
    expect(toLocalDateStr(new Date(2026, 3, 28))).toBe('2026-04-28')
  })
})
