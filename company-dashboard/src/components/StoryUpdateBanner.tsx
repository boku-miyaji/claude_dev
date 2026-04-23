import { useEffect, useState } from 'react'
import { useArcReader } from '@/hooks/useArcReader'
import { useThemeFinder } from '@/hooks/useThemeFinder'

const SEEN_PREFIX = 'fy_story_seen_'

function isSeen(type: string, updatedAt: string | null): boolean {
  if (!updatedAt) return true
  return localStorage.getItem(SEEN_PREFIX + type + '_' + updatedAt) === '1'
}

function markSeen(type: string, updatedAt: string | null) {
  if (!updatedAt) return
  localStorage.setItem(SEEN_PREFIX + type + '_' + updatedAt, '1')
}

/**
 * Arc / Theme が更新されたとき、Home 最上部に表示する通知バナー。
 * "チェック" で localStorage に既読フラグを立てて非表示にする。
 * 次回更新（updated_at 変化）で再表示される。
 */
export function StoryUpdateBanner() {
  const { arc, loading: arcLoading, updatedAt: arcUpdatedAt } = useArcReader()
  const { theme, loading: themeLoading, updatedAt: themeUpdatedAt } = useThemeFinder()

  const [arcDismissed, setArcDismissed] = useState(true)
  const [themeDismissed, setThemeDismissed] = useState(true)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (arcLoading || themeLoading) return
    setArcDismissed(isSeen('arc', arcUpdatedAt))
    setThemeDismissed(isSeen('theme', themeUpdatedAt))
    setReady(true)
  }, [arcLoading, themeLoading, arcUpdatedAt, themeUpdatedAt])

  if (!ready) return null

  const showArc = !!arc && !arcDismissed
  const showTheme = !!theme && !themeDismissed

  if (!showArc && !showTheme) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
      {showTheme && (
        <div style={{
          padding: '12px 14px',
          background: 'var(--accent-bg)',
          border: '1px solid var(--accent-border)',
          borderRadius: 8,
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent2)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>
              あなたのテーマ
            </div>
            <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, fontWeight: 500 }}>
              {theme.identity}
            </div>
            {theme.aspirations && (
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4, lineHeight: 1.5 }}>
                {theme.aspirations}
              </div>
            )}
          </div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 11, padding: '3px 10px', flexShrink: 0 }}
            onClick={() => { markSeen('theme', themeUpdatedAt); setThemeDismissed(true) }}
          >
            チェック ✓
          </button>
        </div>
      )}

      {showArc && (
        <div style={{
          padding: '12px 14px',
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>
              最近の変化
            </div>
            <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
              {arc.narrative}
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 11, padding: '3px 10px', flexShrink: 0 }}
            onClick={() => { markSeen('arc', arcUpdatedAt); setArcDismissed(true) }}
          >
            チェック ✓
          </button>
        </div>
      )}
    </div>
  )
}
