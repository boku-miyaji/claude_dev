import { useMemo, useState } from 'react'
import { Card, PageHeader, Button, EmptyState } from '@/components/ui'
import {
  useUserManual,
  CATEGORY_META,
  displayText,
  isEdited,
  type ManualCard,
  type ManualCategory,
  type ManualPendingUpdate,
  type ManualEditLogEntry,
} from '@/hooks/useUserManual'

const STALE_DAYS = 30

function daysSince(iso: string | null | undefined): number {
  if (!iso) return Infinity
  return (Date.now() - new Date(iso).getTime()) / 86400000
}

/**
 * 自分の取扱説明書 — Layer 2 (言語化) → Layer 3 (行動) の橋渡しページ。
 *
 * Theme Finder が日記から生成した種カードを、ユーザーが自分の言葉に編集する。
 * AI の言葉のままだと他人事。自分の言葉になった瞬間に行動が変わる。
 */
export function Manual() {
  const {
    cards,
    pending,
    loading,
    generating,
    editCard,
    addCard,
    togglePin,
    archiveCard,
    generateSeedCards,
    acceptUpdate,
    rejectUpdate,
    dismissUpdate,
    editProposalSeed,
    fetchHistory,
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

  async function onGenerate(category?: ManualCategory) {
    const result = await generateSeedCards(category)
    if (result && !result.ok && result.reason === 'insufficient_data') {
      alert('日記・Rootsのデータがまだ不足しています。もう少し書いてから試してみてください。')
    }
  }

  // Pending proposals grouped by category for inline per-category display
  const pendingByCategory = useMemo(() => {
    const m = new Map<ManualCategory, ManualPendingUpdate[]>()
    for (const p of pending) {
      if (!m.has(p.category)) m.set(p.category, [])
      m.get(p.category)!.push(p)
    }
    return m
  }, [pending])

  // Stale categories — cards older than STALE_DAYS and not pending updates
  const staleCategories = useMemo(() => {
    const map = new Map<ManualCategory, boolean>()
    for (const c of cards) {
      if (pendingByCategory.has(c.category)) continue
      if (c.source !== 'theme_finder') continue
      const age = daysSince(c.updated_at ?? c.created_at)
      if (age >= STALE_DAYS) map.set(c.category, true)
    }
    return map
  }, [cards, pendingByCategory])

  return (
    <div className="page">
      <PageHeader
        title="自分の取扱説明書"
        description="AI が日記・Rootsから書いた下書きを、自分の言葉に書き換えて手元に置くページ。更新はAIが候補として提案 → 承認で反映されます。"
        actions={
          <Button onClick={() => onGenerate()} disabled={generating}>
            {generating ? '生成中…' : cards.length === 0 ? '下書きを作る' : '全カテゴリ再生成'}
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
            const pendingForCat = pendingByCategory.get(category) ?? []
            const isStale = staleCategories.has(category)
            if (list.length === 0 && pendingForCat.length === 0 && category !== 'custom') return null
            return (
              <section key={category} style={{ marginBottom: 28 }}>
                <div style={{ marginBottom: 10, display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{meta.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{meta.description}</div>
                  </div>
                  <div style={{ flex: 1 }} />
                  {isStale && (
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(245, 158, 11, 0.15)', color: 'var(--amber)' }}>
                      最終生成から30日以上
                    </span>
                  )}
                  <button
                    onClick={() => onGenerate(category)}
                    disabled={generating}
                    style={{
                      fontSize: 10, padding: '2px 10px', border: '1px solid var(--border)',
                      borderRadius: 4, background: 'transparent', color: 'var(--text2)', cursor: 'pointer',
                    }}
                  >
                    {generating ? '生成中…' : 'このカテゴリだけ再生成'}
                  </button>
                </div>

                {/* Pending proposals from AI */}
                {pendingForCat.map((p) => (
                  <PendingProposalCard
                    key={p.id}
                    proposal={p}
                    onAccept={() => acceptUpdate(p.id)}
                    onReject={() => rejectUpdate(p.id)}
                    onDismiss={() => dismissUpdate(p.id)}
                    onEditSeed={(idx, t) => editProposalSeed(p.id, idx, t)}
                  />
                ))}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {list.map((card) => (
                    <ManualCardRow
                      key={card.id}
                      card={card}
                      onSave={(text) => editCard(card.id, text)}
                      onTogglePin={() => togglePin(card.id, !card.pinned)}
                      onArchive={() => archiveCard(card.id)}
                      fetchHistory={fetchHistory}
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

/* ── Pending proposal card (AI suggestion awaiting approval) ──── */

function PendingProposalCard({
  proposal,
  onAccept,
  onReject,
  onDismiss,
  onEditSeed,
}: {
  proposal: ManualPendingUpdate
  onAccept: () => void
  onReject: () => void
  onDismiss: () => void
  onEditSeed: (seedIndex: number, newText: string) => void | Promise<void>
}) {
  const [busy, setBusy] = useState<'accept' | 'reject' | 'dismiss' | null>(null)
  const [editing, setEditing] = useState<{ idx: number; draft: string } | null>(null)
  const [savingSeed, setSavingSeed] = useState(false)
  const [editedSeeds, setEditedSeeds] = useState<Set<number>>(new Set())
  const seeds = proposal.proposed_content?.seeds ?? []
  const currentCards = proposal.current_content?.cards ?? []
  const hasUserEdited = currentCards.some((c) => c.user_edited)

  async function saveSeedEdit() {
    if (!editing) return
    const trimmed = editing.draft.trim()
    if (!trimmed) {
      setEditing(null)
      return
    }
    setSavingSeed(true)
    try {
      await onEditSeed(editing.idx, trimmed)
      setEditedSeeds((prev) => new Set(prev).add(editing.idx))
      setEditing(null)
    } finally {
      setSavingSeed(false)
    }
  }

  function cancelSeedEdit() {
    setEditing(null)
  }

  return (
    <Card
      style={{
        padding: 14,
        marginBottom: 10,
        background: 'rgba(75, 120, 98, 0.05)',
        borderLeft: '3px solid var(--accent)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent2)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
          🤖 更新候補
        </span>
        {proposal.metadata?.generated_at && (
          <span style={{ fontSize: 10, color: 'var(--text3)' }}>
            {new Date(proposal.metadata.generated_at).toLocaleDateString('ja-JP')}
          </span>
        )}
        {proposal.metadata?.roots_count !== undefined && proposal.metadata.roots_count > 0 && (
          <span style={{ fontSize: 10, color: 'var(--text3)' }}>
            · Roots {proposal.metadata.roots_count}件参照
          </span>
        )}
      </div>

      {/* Proposed new seeds — クリックで編集モード */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
        {seeds.map((s, i) => {
          const isEditingThis = editing?.idx === i
          const wasEdited = editedSeeds.has(i)

          if (isEditingThis) {
            return (
              <div
                key={i}
                style={{
                  paddingLeft: 8,
                  borderLeft: '3px solid var(--accent)',
                }}
              >
                <textarea
                  className="input"
                  value={editing.draft}
                  onChange={(e) => setEditing({ idx: i, draft: e.target.value })}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault()
                      void saveSeedEdit()
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      cancelSeedEdit()
                    }
                  }}
                  autoFocus
                  rows={3}
                  style={{ fontSize: 13, width: '100%', lineHeight: 1.6, resize: 'vertical' }}
                />
                <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
                  <Button variant="ghost" onClick={cancelSeedEdit} disabled={savingSeed}>
                    キャンセル
                  </Button>
                  <Button onClick={() => void saveSeedEdit()} disabled={savingSeed}>
                    {savingSeed ? '保存中…' : '保存'}
                  </Button>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
                  Cmd/Ctrl+Enter で保存 · Esc でキャンセル
                </div>
              </div>
            )
          }

          return (
            <div
              key={i}
              onClick={() => setEditing({ idx: i, draft: s.text })}
              title="クリックで編集"
              style={{
                fontSize: 13,
                lineHeight: 1.7,
                color: 'var(--text)',
                cursor: 'text',
                paddingLeft: 8,
                borderLeft: wasEdited ? '3px solid var(--accent)' : '3px solid transparent',
              }}
            >
              <div>{s.text}</div>
              {s.evidence && s.evidence.length > 0 && (
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
                  根拠: {s.evidence.slice(0, 2).map((q) => `「${q}」`).join(' ')}
                </div>
              )}
              {wasEdited && (
                <div style={{ fontSize: 10, color: 'var(--accent2)', marginTop: 4 }}>
                  ✓ 自分の言葉に編集済み
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Current (for diff) */}
      {currentCards.length > 0 && (
        <details style={{ marginBottom: 10 }}>
          <summary style={{ fontSize: 10, color: 'var(--text3)', cursor: 'pointer' }}>
            現在のカードと比較（{currentCards.length}件）
          </summary>
          <div style={{ marginTop: 6, paddingLeft: 10, borderLeft: '2px solid var(--border)' }}>
            {currentCards.map((c, i) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 4 }}>
                {c.user_edited && <span style={{ color: 'var(--green)', marginRight: 4 }}>✓</span>}
                {c.text}
              </div>
            ))}
          </div>
        </details>
      )}

      {hasUserEdited && (
        <div style={{ fontSize: 10, color: 'var(--amber)', marginBottom: 10 }}>
          ⚠️ 自分で編集したカードがこのカテゴリにあります。承認すると未編集のAI下書きのみ差し替えられます（編集済みは残ります）。
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button
          onClick={async () => { setBusy('dismiss'); await onDismiss() }}
          disabled={busy !== null}
          style={{ fontSize: 11, padding: '4px 10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text3)', cursor: 'pointer' }}
        >
          後で
        </button>
        <button
          onClick={async () => { setBusy('reject'); await onReject() }}
          disabled={busy !== null}
          style={{ fontSize: 11, padding: '4px 10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text3)', cursor: 'pointer' }}
        >
          却下
        </button>
        <button
          onClick={async () => { setBusy('accept'); await onAccept() }}
          disabled={busy !== null}
          style={{ fontSize: 11, padding: '4px 12px', background: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 4, color: '#fff', cursor: 'pointer', fontWeight: 600 }}
        >
          {busy === 'accept' ? '反映中…' : '承認して反映'}
        </button>
      </div>
    </Card>
  )
}

/* ── Single card row with inline edit ─────────────────────────── */

const EDIT_TYPE_LABEL: Record<ManualEditLogEntry['edit_type'], string> = {
  card_edit: '本文を編集',
  card_create: '手動で追加',
  card_archive: 'アーカイブ',
  proposal_seed_edit: '提案を編集',
  proposal_accept: '提案を承認',
  proposal_reject: '提案を却下',
}

function truncateForLog(text: string | null, max = 120): string {
  if (!text) return '—'
  const oneLine = text.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= max) return oneLine
  return oneLine.slice(0, max) + '…'
}

function formatLogTimestamp(iso: string): string {
  const d = new Date(iso)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

function ManualCardRow({
  card,
  onSave,
  onTogglePin,
  onArchive,
  fetchHistory,
}: {
  card: ManualCard
  onSave: (text: string) => void
  onTogglePin: () => void
  onArchive: () => void
  fetchHistory: (cardId: number) => Promise<ManualEditLogEntry[]>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(displayText(card))
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<ManualEditLogEntry[] | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const edited = isEdited(card)

  async function loadHistoryOnce() {
    if (history !== null || historyLoading) return
    setHistoryLoading(true)
    try {
      const entries = await fetchHistory(card.id)
      setHistory(entries)
    } finally {
      setHistoryLoading(false)
    }
  }

  function toggleHistory() {
    const next = !historyOpen
    setHistoryOpen(next)
    if (next) void loadHistoryOnce()
  }

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
          onClick={toggleHistory}
          style={{
            fontSize: 11,
            background: 'transparent',
            border: 'none',
            color: historyOpen ? 'var(--text2)' : 'var(--text3)',
            cursor: 'pointer',
            padding: '2px 4px',
          }}
        >
          履歴
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

      {historyOpen && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: '1px solid var(--border)',
          }}
        >
          {historyLoading ? (
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>読み込み中…</div>
          ) : history === null || history.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>まだ履歴はありません</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {history.map((entry) => (
                <div key={entry.id} style={{ fontSize: 11, lineHeight: 1.6, color: 'var(--text2)' }}>
                  <div style={{ color: 'var(--text3)' }}>
                    [{formatLogTimestamp(entry.edited_at)}] {EDIT_TYPE_LABEL[entry.edit_type] ?? entry.edit_type}
                  </div>
                  <div style={{ paddingLeft: 10, marginTop: 2 }}>
                    <div>
                      <span style={{ color: 'var(--text3)' }}>旧: </span>
                      {truncateForLog(entry.before_text)}
                    </div>
                    <div>
                      <span style={{ color: 'var(--text3)' }}>新: </span>
                      {truncateForLog(entry.after_text)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
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
