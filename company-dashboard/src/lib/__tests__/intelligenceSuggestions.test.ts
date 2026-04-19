import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  adoptSuggestion,
  checkSuggestion,
  dismissSuggestion,
  markImplemented,
  rejectSuggestion,
} from '../intelligenceSuggestions'

/**
 * Lightweight mock for supabase-js fluent chain.
 *
 * Usage per table:
 *   const mock = makeMockClient({
 *     intelligence_suggestions: { selectSingle: {...}, updateResult: {...} },
 *     tasks: { insertSelectSingle: { id: 42 } },
 *   })
 *
 * Each table exposes the minimal chain we invoke in production code.
 */

interface TableMocks {
  /** For `.select('*').eq('id', x).single()` */
  selectSingle?: { data?: unknown; error?: unknown }
  /** For `.update(...).eq('id', x)` */
  updateResult?: { data?: unknown; error?: unknown }
  /** For `.insert(...).select('id').single()` */
  insertSelectSingle?: { data?: unknown; error?: unknown }
}

interface CallLog {
  table: string
  method: string
  args: unknown[]
}

function makeMockClient(tables: Record<string, TableMocks>) {
  const calls: CallLog[] = []

  function from(table: string) {
    const cfg = tables[table] || {}
    const push = (method: string, args: unknown[]) => calls.push({ table, method, args })

    return {
      select(cols: string) {
        push('select', [cols])
        return {
          eq(col: string, val: unknown) {
            push('eq', [col, val])
            return {
              async single() {
                push('single', [])
                return cfg.selectSingle ?? { data: null, error: null }
              },
            }
          },
        }
      },
      update(values: Record<string, unknown>) {
        push('update', [values])
        return {
          async eq(col: string, val: unknown) {
            push('eq', [col, val])
            return cfg.updateResult ?? { data: null, error: null }
          },
        }
      },
      insert(values: Record<string, unknown>) {
        push('insert', [values])
        return {
          select(cols: string) {
            push('select', [cols])
            return {
              async single() {
                push('single', [])
                return cfg.insertSelectSingle ?? { data: null, error: null }
              },
            }
          },
        }
      },
    }
  }

  return { client: { from } as unknown as Parameters<typeof checkSuggestion>[1], calls }
}

const fixedNow = '2026-04-19T10:00:00.000Z'

beforeEach(() => {
  vi.setSystemTime(new Date(fixedNow))
})

describe('dismissSuggestion', () => {
  it('updates status to dismissed with timestamp', async () => {
    const { client, calls } = makeMockClient({
      intelligence_suggestions: { updateResult: { data: null, error: null } },
    })
    await dismissSuggestion('abc', client)
    const updateCall = calls.find((c) => c.method === 'update')
    expect(updateCall).toBeDefined()
    expect(updateCall!.args[0]).toMatchObject({ status: 'dismissed', dismissed_at: fixedNow })
    expect(calls.find((c) => c.method === 'eq')!.args).toEqual(['id', 'abc'])
  })

  it('throws when Supabase returns an error', async () => {
    const { client } = makeMockClient({
      intelligence_suggestions: { updateResult: { data: null, error: { message: 'permission denied' } } },
    })
    await expect(dismissSuggestion('abc', client)).rejects.toBeDefined()
  })
})

describe('adoptSuggestion', () => {
  it('sets status=adopted with adopted_at timestamp', async () => {
    const { client, calls } = makeMockClient({
      intelligence_suggestions: { updateResult: { data: null, error: null } },
    })
    await adoptSuggestion('xyz', client)
    const update = calls.find((c) => c.method === 'update')!
    expect(update.args[0]).toMatchObject({ status: 'adopted', adopted_at: fixedNow })
  })
})

describe('rejectSuggestion', () => {
  it('sets status=rejected with rejected_at timestamp', async () => {
    const { client, calls } = makeMockClient({
      intelligence_suggestions: { updateResult: { data: null, error: null } },
    })
    await rejectSuggestion('xyz', client)
    const update = calls.find((c) => c.method === 'update')!
    expect(update.args[0]).toMatchObject({ status: 'rejected', rejected_at: fixedNow })
  })
})

describe('markImplemented', () => {
  it('sets status=implemented with implemented_at timestamp', async () => {
    const { client, calls } = makeMockClient({
      intelligence_suggestions: { updateResult: { data: null, error: null } },
    })
    await markImplemented('xyz', client)
    const update = calls.find((c) => c.method === 'update')!
    expect(update.args[0]).toMatchObject({ status: 'implemented', implemented_at: fixedNow })
  })
})

describe('checkSuggestion', () => {
  const sampleSuggestion = {
    id: 'sug-1',
    title: 'Memory Agent framework',
    description: 'Improve knowledge promotion via reflection',
    priority: 'high',
    effort: 'medium',
    category: 'algorithm',
    source_report_path: '.company/departments/intelligence/reports/2026-04-18.md',
    source_report_date: '2026-04-18',
    source_urls: ['https://arxiv.org/abs/2604.04503', 'https://anthropic.com'],
    status: 'new',
    task_id: null,
  }

  it('inserts a task and updates the suggestion with task_id', async () => {
    const { client, calls } = makeMockClient({
      intelligence_suggestions: {
        selectSingle: { data: sampleSuggestion, error: null },
        updateResult: { data: null, error: null },
      },
      tasks: {
        insertSelectSingle: { data: { id: 42 }, error: null },
      },
    })

    const taskId = await checkSuggestion('sug-1', client)
    expect(taskId).toBe(42)

    // Verify tasks INSERT happened
    const insertCall = calls.find((c) => c.table === 'tasks' && c.method === 'insert')
    expect(insertCall).toBeDefined()
    const inserted = insertCall!.args[0] as Record<string, unknown>
    expect(inserted.title).toBe('[insight] Memory Agent framework')
    expect(inserted.type).toBe('request')
    expect(inserted.status).toBe('open')
    expect(inserted.priority).toBe('high')
    expect(inserted.tags).toEqual(['from-intelligence', 'insight', 'algorithm'])
    // description should include source info
    expect(inserted.description).toContain('Improve knowledge promotion via reflection')
    expect(inserted.description).toContain('Source: .company/departments/intelligence/reports/2026-04-18.md')
    expect(inserted.description).toContain('https://arxiv.org/abs/2604.04503')

    // Verify suggestion UPDATE happened with checked status + task_id
    const updateCall = calls.find((c) => c.table === 'intelligence_suggestions' && c.method === 'update')
    expect(updateCall).toBeDefined()
    const updated = updateCall!.args[0] as Record<string, unknown>
    expect(updated.status).toBe('checked')
    expect(updated.task_id).toBe(42)
    expect(updated.checked_at).toBe(fixedNow)
  })

  it('maps medium priority to normal task priority', async () => {
    const { client, calls } = makeMockClient({
      intelligence_suggestions: {
        selectSingle: { data: { ...sampleSuggestion, priority: 'medium' }, error: null },
        updateResult: { data: null, error: null },
      },
      tasks: { insertSelectSingle: { data: { id: 7 }, error: null } },
    })

    await checkSuggestion('sug-1', client)
    const insertCall = calls.find((c) => c.table === 'tasks' && c.method === 'insert')!
    const inserted = insertCall.args[0] as Record<string, unknown>
    expect(inserted.priority).toBe('normal')
  })

  it('defaults priority to normal when suggestion has no priority', async () => {
    const { client, calls } = makeMockClient({
      intelligence_suggestions: {
        selectSingle: { data: { ...sampleSuggestion, priority: null }, error: null },
        updateResult: { data: null, error: null },
      },
      tasks: { insertSelectSingle: { data: { id: 7 }, error: null } },
    })
    await checkSuggestion('sug-1', client)
    const inserted = calls.find((c) => c.table === 'tasks' && c.method === 'insert')!.args[0] as Record<string, unknown>
    expect(inserted.priority).toBe('normal')
  })

  it('uses "other" category when suggestion has no category', async () => {
    const { client, calls } = makeMockClient({
      intelligence_suggestions: {
        selectSingle: { data: { ...sampleSuggestion, category: null }, error: null },
        updateResult: { data: null, error: null },
      },
      tasks: { insertSelectSingle: { data: { id: 7 }, error: null } },
    })
    await checkSuggestion('sug-1', client)
    const inserted = calls.find((c) => c.table === 'tasks' && c.method === 'insert')!.args[0] as Record<string, unknown>
    expect(inserted.tags).toEqual(['from-intelligence', 'insight', 'other'])
  })

  it('throws when suggestion fetch fails', async () => {
    const { client } = makeMockClient({
      intelligence_suggestions: {
        selectSingle: { data: null, error: { message: 'not found' } },
      },
    })
    await expect(checkSuggestion('sug-1', client)).rejects.toBeDefined()
  })

  it('throws when task INSERT fails and does not UPDATE suggestion', async () => {
    const { client, calls } = makeMockClient({
      intelligence_suggestions: {
        selectSingle: { data: sampleSuggestion, error: null },
      },
      tasks: { insertSelectSingle: { data: null, error: { message: 'insert failed' } } },
    })

    await expect(checkSuggestion('sug-1', client)).rejects.toBeDefined()

    // Ensure no UPDATE was made to the suggestion
    const updateCall = calls.find((c) => c.table === 'intelligence_suggestions' && c.method === 'update')
    expect(updateCall).toBeUndefined()
  })
})
