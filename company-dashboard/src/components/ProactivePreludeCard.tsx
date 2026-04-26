import { useEffect } from 'react'
import { usePrelude } from '@/hooks/usePrelude'

/**
 * ProactivePreludeCard — Today 上部の「前奏」カード。
 *
 * 設計参照:
 *   - arXiv:2604.00842 (Pare): proactive agent / intervention timing
 *   - scripts/proactive-prep/: 夜間バッチが kind を決めて本文を生成
 *   - Migration 069: proactive_preparations
 *
 * 設計原則 (silence-first × proactive):
 *   - 当日分が用意されていなければ何も表示しない (null を返す)
 *   - 装飾ゼロ。引用符・左バー・イタリック・絵文字を使わない
 *   - 通知・トースト・モーダルは出さない
 *   - 「閉じる」操作だけ提供（×ボタン）。それ以外でユーザーは何もしなくて良い
 *   - design-philosophy ⑪: 完全な受動表示
 */
export function ProactivePreludeCard() {
  const { prelude, loading, markViewed, dismiss } = usePrelude()

  // 表示できたタイミングで一度だけ viewed をマーク（監査用シグナル）
  useEffect(() => {
    if (!loading && prelude && prelude.status === 'ready') {
      void markViewed()
    }
  }, [loading, prelude, markViewed])

  if (loading) {
    return (
      <div
        style={{
          position: 'relative',
          padding: '20px 20px',
          marginBottom: 16,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          minHeight: 80,
        }}
        aria-hidden="true"
      >
        <div style={{ height: 16, background: 'var(--surface2)', borderRadius: 4, marginBottom: 8, width: '70%' }} />
        <div style={{ height: 16, background: 'var(--surface2)', borderRadius: 4, width: '45%' }} />
      </div>
    )
  }

  if (!prelude) return null

  return (
    <aside
      role="note"
      aria-label="今日の前奏"
      style={{
        position: 'relative',
        padding: '18px 20px',
        marginBottom: 16,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
      }}
    >
      {/* dismiss × ボタン（右上、薄く） */}
      <button
        type="button"
        onClick={() => void dismiss()}
        aria-label="今日は閉じる"
        title="今日は閉じる"
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          width: 24,
          height: 24,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text3)',
          fontSize: 14,
          padding: 0,
          lineHeight: 1,
        }}
      >
        <span aria-hidden="true">×</span>
      </button>

      {/* 本文 (主役・最大 2行想定) */}
      <p
        style={{
          margin: 0,
          padding: 0,
          paddingRight: 28, // × ボタンと重ならない
          fontSize: 15,
          lineHeight: 1.7,
          color: 'var(--text)',
          fontWeight: 400,
          whiteSpace: 'pre-wrap',
        }}
      >
        {prelude.body}
      </p>

      {/* hint (補足 / 任意) */}
      {prelude.hint && (
        <p
          style={{
            margin: '10px 0 0 0',
            padding: 0,
            fontSize: 12,
            lineHeight: 1.6,
            color: 'var(--text3)',
            fontWeight: 400,
            whiteSpace: 'pre-wrap',
          }}
        >
          {prelude.hint}
        </p>
      )}
    </aside>
  )
}
