import { useMorningQuote } from '@/hooks/useMorningQuote'

/**
 * MorningQuoteCard — 朝イチの名言カード。
 *
 * 設計書: scratch/design/focus-you/morning-quote-ux-design.md
 *
 * - 日記0件 or 今日分未配信: null を返しセクション自体を非表示
 * - 装飾ゼロ (引用符・左端バー・イタリックを使わない)
 * - 本文 17px 主役 / 発言者 12px / 年代・出典 11px
 * - 右上ハートアイコンのみ。トースト・モーダル・通知は使わない
 * - 完全な受動表示 (design-philosophy ⑪)。ユーザー操作で再生成しない
 */
export function MorningQuoteCard() {
  const { quote, loading, isFavorited, toggleFavorite } = useMorningQuote()

  // ローディング中は場所だけ確保（CLS 回避）
  if (loading) {
    return (
      <div
        style={{
          position: 'relative',
          padding: '24px 20px',
          marginBottom: 16,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          minHeight: 120,
        }}
        aria-hidden="true"
      >
        <div style={{ height: 17, background: 'var(--surface2)', borderRadius: 4, marginBottom: 10, width: '80%' }} />
        <div style={{ height: 17, background: 'var(--surface2)', borderRadius: 4, marginBottom: 24, width: '55%' }} />
        <div style={{ height: 12, background: 'var(--surface2)', borderRadius: 4, width: '30%' }} />
      </div>
    )
  }

  // 仕様: 未配信 or 日記0件は完全に非表示（フォールバック文言も出さない）
  if (!quote) return null

  const metaParts: string[] = []
  if (quote.authorEra) metaParts.push(quote.authorEra)
  if (quote.source) metaParts.push(quote.source)

  return (
    <figure
      role="figure"
      aria-label="今日の一節"
      style={{
        position: 'relative',
        padding: '24px 20px',
        marginBottom: 16,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        margin: '0 0 16px 0',
      }}
    >
      {/* お気に入りハート (右上, 装飾は最小) */}
      <button
        type="button"
        onClick={toggleFavorite}
        aria-pressed={isFavorited}
        aria-label={isFavorited ? 'お気に入りを解除' : 'お気に入りに追加'}
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          width: 32,
          height: 32,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: isFavorited ? 'var(--accent)' : 'var(--text3)',
          fontSize: 16,
          padding: 0,
          transition: 'color 150ms ease-out, transform 120ms ease-out',
        }}
      >
        <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>
          {isFavorited ? '\u2665' : '\u2661'}
        </span>
      </button>

      {/* 本文 (主役) */}
      <blockquote
        cite={quote.sourceUrl ?? undefined}
        style={{
          margin: 0,
          padding: 0,
          fontSize: 17,
          lineHeight: 1.8,
          color: 'var(--text)',
          fontWeight: 400,
          whiteSpace: 'pre-wrap',
          paddingRight: 32, // ハートと重ならない余白
        }}
      >
        {quote.body}
      </blockquote>

      {/* 発言者 + 年代・出典 */}
      <figcaption
        style={{
          marginTop: 24,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 12,
            color: 'var(--text2)',
            fontWeight: 500,
          }}
        >
          {quote.author}
        </span>
        {metaParts.length > 0 && (
          <span
            style={{
              fontSize: 11,
              color: 'var(--text3)',
              fontWeight: 400,
            }}
          >
            {metaParts.join(' / ')}
          </span>
        )}
      </figcaption>
    </figure>
  )
}
