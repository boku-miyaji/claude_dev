import { supabase } from '@/lib/supabase'

const BUCKET = 'request-attachments'
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export interface AttachmentMeta {
  path: string
  type: string
  size: number
  name: string
}

/**
 * Upload a single image attachment. Path scheme: {user_id}/{timestamp}-{index}.{ext}.
 * Returns metadata on success or throws on oversize / auth errors, returns null on upload failure.
 */
export async function uploadRequestAttachment(file: File, index: number): Promise<AttachmentMeta | null> {
  if (!file.type.startsWith('image/')) {
    throw new Error('画像ファイルのみ添付できます')
  }
  if (file.size > MAX_SIZE) {
    throw new Error(`画像が大きすぎます (${Math.round(file.size / 1024 / 1024)}MB). 5MB以下にしてください`)
  }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('not authenticated')

  const ext = (file.name.split('.').pop() || 'png').toLowerCase()
  const path = `${user.id}/${Date.now()}-${index}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })
  if (error) {
    console.error('[requestAttachments] upload failed', error)
    return null
  }
  return {
    path,
    type: file.type,
    size: file.size,
    name: file.name || `attachment-${index}.${ext}`,
  }
}

/**
 * Signed URL cache for the lifetime of the session.
 */
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>()

export async function getRequestAttachmentUrl(path: string, expiresInSec = 3600): Promise<string | null> {
  const cached = signedUrlCache.get(path)
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.url

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSec)
  if (error || !data) {
    console.error('[requestAttachments] signed url failed', error)
    return null
  }
  signedUrlCache.set(path, { url: data.signedUrl, expiresAt: Date.now() + expiresInSec * 1000 })
  return data.signedUrl
}

export async function deleteRequestAttachment(path: string): Promise<boolean> {
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) {
    console.error('[requestAttachments] delete failed', error)
    return false
  }
  signedUrlCache.delete(path)
  return true
}
