import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface MutationResult {
  loading: boolean
  error: string | null
}

interface InsertResult<T> extends MutationResult {
  insert: (data: Partial<T>) => Promise<T | null>
}

interface UpdateResult<T> extends MutationResult {
  update: (id: string, data: Partial<T>) => Promise<T | null>
}

interface DeleteResult extends MutationResult {
  remove: (id: string) => Promise<boolean>
}

export function useSupabaseInsert<T = Record<string, unknown>>(table: string): InsertResult<T> {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const insert = useCallback(async (data: Partial<T>): Promise<T | null> => {
    setLoading(true)
    setError(null)
    const { data: row, error: err } = await supabase
      .from(table)
      .insert(data as Record<string, unknown>)
      .select()
      .single()
    setLoading(false)
    if (err) { setError(err.message); return null }
    return row as T
  }, [table])

  return { insert, loading, error }
}

export function useSupabaseUpdate<T = Record<string, unknown>>(table: string): UpdateResult<T> {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = useCallback(async (id: string, data: Partial<T>): Promise<T | null> => {
    setLoading(true)
    setError(null)
    const { data: row, error: err } = await supabase
      .from(table)
      .update(data as Record<string, unknown>)
      .eq('id', id)
      .select()
      .single()
    setLoading(false)
    if (err) { setError(err.message); return null }
    return row as T
  }, [table])

  return { update, loading, error }
}

export function useSupabaseDelete(table: string): DeleteResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remove = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true)
    setError(null)
    const { error: err } = await supabase
      .from(table)
      .delete()
      .eq('id', id)
    setLoading(false)
    if (err) { setError(err.message); return false }
    return true
  }, [table])

  return { remove, loading, error }
}
