import { useMemo, useState } from 'react'
import { Card, PageHeader, Button, EmptyState } from '@/components/ui'
import {
  useUserManual,
  CATEGORY_META,
  displayText,
  isEdited,
  type ManualCard,
  type ManualCategory,
} from '@/hooks/useUserManual'

/**
 * 自分の取扱説明書 — Layer 2 (言語化) → Layer 3 (行動) の橋渡しページ。
 *
 * Theme Finder が日記から生成した種カードを、ユーザーが自分の言葉に編集する。
 * AI の言葉のままだと他人事。自分の言葉になった瞬間に行動が変わる。
 */
export function Manual() {
  const {
    cards,
    loading,
    generating,
    editCard,
    addCard,
    togglePin,
    archiveCard,
    generateSeedCards,
  } = useUserManual()

  const grouped = useMemo(() => {
    const map = new Map<ManualCategory, ManualCard[]>()
    for (const c of cards) {
      const arr = map.get(c.category) ?? []
      arr.push(c)
      map.set(c.category, arr)
    }
    return map
  }, [cards])

  const orderedCategories = useMemo(
    () =>
      (Object.entries(CATEGORY_META) as Array<[ManualCategory, typeof CATEGORY_META[ManualCategory]]>)
        .sort((a, b) => a[1].order - b[1].order),
    [],
  )

  const pinned = useMemo(() => cards.filter((c) => c.pinned), [cards])
  const editedCount = cards.filter(isEdited).length

  async function onGenerate() {
    const result = await generateSeedCards()
    if (result && !result.ok && result.reason === 'insufficient_data') {
      alert('日記のデータがまだ不足しています。もう少し書いてから試してみてください。')
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="自分の取扱説明書"
        description="AI が書いた言葉を、自分の言葉に書き換えて手元に置くページ。書き換えた瞬間に、あなたのものになります。"
        actions={
          <Button onClick={onGenerate} disabled={generating}>
            {generating ? '生成中…' : cards.length === 0 ? '日記から生成する' : '種カードを再生成'}
          </Button>
        }
      />

      {loading ? (
        <div style={{ color: 'var(--text3)', fontSize: 13 }}>読み込み中…</div>
      ) : cards.length === 0 ? (
        <EmptyState
          icon="📖"
          message="まだカードがありません。「日記から生成する」で Theme Finder が過去の日記から取扱説明書の種を作ります。その後は自分の言葉に編集してください。"
          actionLabel={generating ? '生成中…' : '日記から生成する'}
          onAction={onGenerate}
        />
      ) : (
        <>
          {/* サマリー */}
          <Card style={{ padding: 14, marginBottom: 16, background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7 }}>
              全 <strong>{cards.length}</strong> カード / 自分の言葉にしたもの <strong>{editedCount}</strong>
              {pinned.length > 0 && <> / ピン留め <strong>{pinned.length}</strong></>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, lineHeight: 1.6 }}>
              AI が下書きした文を、自分がしっくりくる言葉に書き換えるのが肝心です。書き換えた瞬間に「自分のもの」になります。
            </div>
          </Card>

          {orderedCategories.map(([category, meta]) => {
            const list = grouped.get(category) ?? []
            if (list.length === 0 && category !== 'custom') return null
            return (
              <section key={category} style={{ marginBottom: 28 }}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{meta.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{meta.description}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {list.map((card) => (
                    <ManualCardRow
                      key={card.id}
                      card={card}
                      onSave={(text) => editCard(card.id, text)}
                      onTogglePin={() => togglePin(card.id, !card.pinned)}
                      onArchive={() => archiveCard(card.id)}
                    />
                  ))}
                  <AddCardInline category={category} onAdd={(text) => addCard(category, text)} />
                </div>
              </section>
            )
          })}
        </>
      )}
    </div>
  )
}

/* ── Single card row with inline edit ─────────────────────────── */

function ManualCardRow({
  card,
  onSave,
  onTogglePin,
  onArchive,
}: {
  card: ManualCard
  onSave: (text: string) => void
  onTogglePin: () => void
  onArchive: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(displayText(card))
  const edited = isEdited(card)

  function save() {
    onSave(draft)
    setEditing(false)
  }

  function cancel() {
    setDraft(displayText(card))
    setEditing(false)
  }

  if (editing) {
    return (
      <Card style={{ padding: 14, border: '1px solid var(--accent)' }}>
        <textarea
          className="input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') save()
            if (e.key === 'Escape') cancel()
          }}
          autoFocus
          rows={3}
          style={{ fontSize: 13, width: '100%', lineHeight: 1.6, resize: 'vertical' }}
        />
        <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={cancel}>キャンセル</Button>
          <Button onClick={save}>保存</Button>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>
          Cmd/Ctrl+Enter で保存 · Esc でキャンセル
        </div>
      </Card>
    )
  }

  return (
    <Card
      style={{
        padding: 14,
        borderLeft: edited ? '3px solid var(--green)' : '3px solid var(--surface2)',
      }}
    >
      <div
        onClick={() => setEditing(true)}
        style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text)', cursor: 'text', minHeight: 20 }}
      >
        {displayText(card) || <span style={{ color: 'var(--text3)' }}>（クリックして自分の言葉で書く）</span>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        {edited ? (
          <span style={{ fontSize: 10, color: 'var(--green)', fontWeight: 600 }}>✓ 自分の言葉</span>
        ) : (
          <span style={{ fontSize: 10, color: 'var(--text3)' }}>AI の下書き</span>
        )}
        {card.evidence && card.evidence.length > 0 && (
          <span style={{ fontSize: 10, color: 'var(--text3)' }}>
            根拠: {card.evidence.slice(0, 2).map((e) => `「${e.quote ?? ''}」`).join(' ')}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={onTogglePin}
          title={card.pinned ? 'ピン留め解除' : 'ピン留め'}
          style={{
            fontSize: 11,
            background: 'transparent',
            border: 'none',
            color: card.pinned ? 'var(--amber)' : 'var(--text3)',
            cursor: 'pointer',
            padding: '2px 4px',
          }}
        >
          {card.pinned ? '★' : '☆'}
        </button>
        <button
          onClick={() => setEditing(true)}
          style={{
            fontSize: 11,
            background: 'transparent',
            border: 'none',
            color: 'var(--text3)',
            cursor: 'pointer',
            padding: '2px 4px',
          }}
        >
          編集
        </button>
        <button
          onClick={() => {
            if (confirm('このカードをアーカイブしますか？')) onArchive()
          }}
          style={{
            fontSize: 11,
            background: 'transparent',
            border: 'none',
            color: 'var(--text3)',
            cursor: 'pointer',
            padding: '2px 4px',
          }}
        >
          ×
        </button>
      </div>
    </Card>
  )
}

/* ── Inline add row ──────────────────────────────────────────── */

function AddCardInline({ category, onAdd }: { category: ManualCategory; onAdd: (text: string) => void }) {
  const [text, setText] = useState('')
  const [expanded, setExpanded] = useState(false)

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        style={{
          fontSize: 11,
          color: 'var(--text3)',
          background: 'transparent',
          border: '1px dashed var(--border)',
          borderRadius: 6,
          padding: '8px 12px',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        + {CATEGORY_META[category].label} を自分で追加する
      </button>
    )
  }

  function submit() {
    if (text.trim()) {
      onAdd(text)
      setText('')
    }
    setExpanded(false)
  }

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <input
        className="input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit()
          if (e.key === 'Escape') {
            setText('')
            setExpanded(false)
          }
        }}
        placeholder="自分の言葉で書く"
        autoFocus
        style={{ flex: 1, fontSize: 13 }}
      />
      <Button onClick={submit}>追加</Button>
    </div>
  )
}
