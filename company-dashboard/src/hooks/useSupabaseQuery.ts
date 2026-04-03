import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Filter {
  column: string
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like' | 'ilike'
  value: unknown
}

interface Options {
  table: string
  select?: string
  filters?: Filter[]
  order?: { column: string; ascending?: boolean }
  limit?: number
  enabled?: boolean
}

interface Result<T> {
  data: T[] | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useSupabaseQuery<T = Record<string, unknown>>(opts: Options): Result<T> {
  const [data, setData] = useState<T[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (opts.enabled === false) { setLoading(false); return }
    setLoading(true)
    setError(null)

    let query = supabase.from(opts.table).select(opts.select || '*')

    if (opts.filters) {
      for (const f of opts.filters) {
        query = (query as any)[f.op](f.column, f.value)
      }
    }
    if (opts.order) {
      query = query.order(opts.order.column, { ascending: opts.order.ascending ?? true })
    }
    if (opts.limit) {
      query = query.limit(opts.limit)
    }

    const { data: rows, error: err } = await query
    if (err) {
      setError(err.message)
      setData(null)
    } else {
      setData(rows as T[])
    }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.table, opts.select, opts.enabled, JSON.stringify(opts.filters), JSON.stringify(opts.order), opts.limit])

  useEffect(() => { fetch() }, [fetch])

  return { data, loading, error, refetch: fetch }
}
