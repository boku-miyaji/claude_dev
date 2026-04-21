import { Card } from '@/components/ui'
import { useFavoriteQuotes, type FavoriteQuote } from '@/hooks/useFavoriteQuotes'

/**
 * FavoriteQuoteList — Journal タブ内で表示するお気に入り名言一覧。
 *
 * 設計書: scratch/design/focus-you/morning-quote-ux-design.md §5
 * - 保存日降順固定
 * - カード右上ハート押下で即座に削除（スライドアウトなしで楽観的 UI）
 * - 空状態は「まだ何もありません」のみ
 * - 検索・フィルタは初期リリース不要
 */
export function FavoriteQuoteList() {
  const { quotes, loading, removeFavorite } = useFavoriteQuotes()

  if (loading) {
    return (
      <div style={{ fontSize: 12, color: 'var(--text3)', padding: 16, textAlign: 'center' }}>
        Loading...
      </div>
    )
  }

  if (quotes.length === 0) {
    return (
      <Card style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>
          まだ何もありません
        </div>
      </Card>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {quotes.map((q) => (
        <FavoriteQuoteRow key={q.favoriteId} quote={q} onRemove={() => removeFavorite(q.quoteId)} />
      ))}
    </div>
  )
}

interface RowProps {
  quote: FavoriteQuote
  onRemove: () => void
}

function FavoriteQuoteRow({ quote, onRemove }: RowProps) {
  const metaParts: string[] = []
  if (quote.authorEra) metaParts.push(quote.authorEra)
  if (quote.source) metaParts.push(quote.source)

  const savedDate = new Date(quote.favoritedAt).toLocaleDateString('ja-JP')

  return (
    <figure
      role="figure"
      aria-label={`${quote.author} の一節`}
      style={{
        position: 'relative',
        padding: '20px 18px',
        margin: 0,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
      }}
    >
      <button
        type="button"
        onClick={onRemove}
        aria-label="お気に入りを解除"
        aria-pressed={true}
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          width: 32,
          height: 32,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--accent)',
          fontSize: 16,
          padding: 0,
          transition: 'color 150ms ease-out, transform 120ms ease-out',
        }}
      >
        <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>
          {'\u2665'}
        </span>
      </button>

      <blockquote
        cite={quote.sourceUrl ?? undefined}
        style={{
          margin: 0,
          padding: 0,
          fontSize: 15,
          lineHeight: 1.75,
          color: 'var(--text)',
          fontWeight: 400,
          whiteSpace: 'pre-wrap',
          paddingRight: 32,
        }}
      >
        {quote.body}
      </blockquote>

      <figcaption
        style={{
          marginTop: 18,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>
          {quote.author}
        </span>
        {metaParts.length > 0 && (
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>
            {metaParts.join(' / ')}
          </span>
        )}
      </figcaption>

      <div
        style={{
          marginTop: 10,
          fontSize: 10,
          color: 'var(--text3)',
          fontFamily: 'var(--mono)',
        }}
      >
        保存: {savedDate}
      </div>
    </figure>
  )
}
