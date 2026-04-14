import { supabase } from '@/lib/supabase'

const BUCKET = 'diary-images'
const MAX_SIZE = 10 * 1024 * 1024

/**
 * Upload an image file. Path scheme: {user_id}/{timestamp}-{index}.{ext}.
 * Returns the storage object path (not a signed URL) so callers can
 * resolve signed URLs on display.
 */
export async function uploadDiaryImage(file: File, index: number): Promise<string | null> {
  if (file.size > MAX_SIZE) {
    throw new Error(`画像が大きすぎます (${Math.round(file.size / 1024 / 1024)}MB). 10MB以下にしてください`)
  }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('not authenticated')

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${user.id}/${Date.now()}-${index}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })
  if (error) {
    console.error('[diaryImages] upload failed', error)
    return null
  }
  return path
}

/**
 * Get a signed URL for a stored diary image path.
 * Cached per path for the lifetime of the session.
 */
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>()

export async function getDiaryImageUrl(path: string, expiresInSec = 3600): Promise<string | null> {
  const cached = signedUrlCache.get(path)
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.url

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSec)
  if (error || !data) {
    console.error('[diaryImages] signed url failed', error)
    return null
  }
  signedUrlCache.set(path, { url: data.signedUrl, expiresAt: Date.now() + expiresInSec * 1000 })
  return data.signedUrl
}

export async function deleteDiaryImage(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path])
  signedUrlCache.delete(path)
}
