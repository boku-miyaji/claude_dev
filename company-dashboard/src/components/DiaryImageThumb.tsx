import { useEffect, useState } from 'react'
import { getDiaryImageUrl } from '@/lib/diaryImages'

interface Props {
  path: string
  size?: number
  onClick?: () => void
  alt?: string
}

/**
 * Thumbnail component that resolves a signed URL for a stored diary image.
 * Caches the URL via getDiaryImageUrl's internal cache.
 */
export function DiaryImageThumb({ path, size = 64, onClick, alt = '' }: Props) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    getDiaryImageUrl(path).then((u) => { if (mounted) setUrl(u) })
    return () => { mounted = false }
  }, [path])

  if (!url) {
    return (
      <div style={{
        width: size, height: size, borderRadius: 6, background: 'var(--bg2)',
        border: '1px solid var(--border)',
      }} />
    )
  }
  return (
    <img
      src={url}
      alt={alt}
      onClick={onClick}
      style={{
        width: size, height: size, objectFit: 'cover', borderRadius: 6,
        border: '1px solid var(--border)', cursor: onClick ? 'pointer' : 'default',
        display: 'block',
      }}
    />
  )
}
