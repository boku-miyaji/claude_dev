import { useEffect, useState } from 'react'
import { getRequestAttachmentUrl } from '@/lib/requestAttachments'

interface Props {
  path: string
  size?: number
  onClick?: () => void
  onRemove?: () => void
  alt?: string
}

/**
 * Thumbnail for a request attachment. Resolves a signed URL and caches it.
 * Optional onRemove renders a small x button in the corner.
 */
export function RequestAttachmentThumb({ path, size = 64, onClick, onRemove, alt = '' }: Props) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    getRequestAttachmentUrl(path).then((u) => { if (mounted) setUrl(u) })
    return () => { mounted = false }
  }, [path])

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      {url ? (
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
      ) : (
        <div style={{
          width: size, height: size, borderRadius: 6, background: 'var(--bg2)',
          border: '1px solid var(--border)',
        }} />
      )}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          title="削除"
          style={{
            position: 'absolute', top: -6, right: -6, width: 18, height: 18,
            borderRadius: '50%', border: '1px solid var(--border)',
            background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer',
            fontSize: 11, lineHeight: '16px', padding: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          &times;
        </button>
      )}
    </div>
  )
}
