import { useState, useRef, useEffect } from 'react'
import { Card } from '@/components/ui'
import { aiPartnerChat, type PartnerChatMessage, type SavedMemory } from '@/lib/edgeAi'

interface MessageMeta {
  savedMemories?: SavedMemory[]
  forgottenMemories?: number
}

interface Props {
  /** 呼び出し元の識別（chat_interactions の entry_point に使う） */
  entryPoint?: string
  /** カードの下にさらに表示するチルドレン（例: StoryArcCard） */
  children?: React.ReactNode
  /** AI Partner の自動生成コメント。あれば collapsed 状態に表示する */
  briefingMessage?: string | null
}

/** AI Partner のインライン対話カード。Today ページに常駐し、クリックで展開して会話できる。 */
export function FutureYouChat({ entryPoint = 'today_partner', children, briefingMessage }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [history, setHistory] = useState<PartnerChatMessage[]>([])
  const [messageMeta, setMessageMeta] = useState<Record<number, MessageMeta>>({})
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sessionIdRef = useRef<string>(`partner-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (expanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [history, expanded])

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return
    setError(null)
    setSending(true)
    const userMsg: PartnerChatMessage = { role: 'user', content: text }
    const nextHistory = [...history, userMsg]
    setHistory(nextHistory)
    setInput('')
    try {
      const { content, savedMemories, forgottenMemories } = await aiPartnerChat(text, history, {
        sessionId: sessionIdRef.current,
        entryPoint,
      })

      const nextAll = [...nextHistory, { role: 'assistant' as const, content }]
      setHistory(nextAll)
      if (savedMemories.length > 0 || forgottenMemories > 0) {
        const assistantIdx = nextAll.length - 1
        setMessageMeta((prev) => ({
          ...prev,
          [assistantIdx]: { savedMemories, forgottenMemories },
        }))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました')
      setHistory(nextHistory)
    } finally {
      setSending(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      send()
    }
  }

  return (
    <Card style={{ marginBottom: 16, background: 'var(--accent-bg)', border: '1px solid var(--accent-border)' }}>
      <div style={{ fontSize: 11, color: 'var(--accent2)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.08em' }}>
        AI Partner
      </div>

      {!expanded && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            flex: 1,
            fontSize: briefingMessage ? 13 : 12,
            color: briefingMessage ? 'var(--text)' : 'var(--text3)',
            lineHeight: 1.6,
            fontStyle: briefingMessage ? 'normal' : 'italic',
          }}>
            {briefingMessage ?? '話したいことあれば'}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 11, padding: '4px 10px', textTransform: 'none', letterSpacing: 0, flexShrink: 0 }}
            onClick={() => setExpanded(true)}
          >
            話す →
          </button>
        </div>
      )}

      {expanded && (
        <div style={{ marginTop: 14 }}>
          {history.length > 0 && (
            <div
              ref={scrollRef}
              style={{
                maxHeight: 360,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                padding: '10px 2px',
                borderTop: '1px solid var(--border)',
                marginBottom: 10,
              }}
            >
              {history.map((m, i) => {
                const meta = messageMeta[i]
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '88%',
                      alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                      gap: 4,
                    }}
                  >
                    <div
                      style={{
                        padding: '9px 13px',
                        borderRadius: 10,
                        background: m.role === 'user' ? 'var(--surface2)' : 'rgba(255,255,255,0.6)',
                        border: m.role === 'assistant' ? '1px solid var(--border)' : 'none',
                        fontSize: 13,
                        color: 'var(--text)',
                        lineHeight: 1.7,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {m.content}
                    </div>
                    {meta && (meta.savedMemories?.length || meta.forgottenMemories) ? (
                      <div
                        title={meta.savedMemories?.map((s) => s.content).join('\n')}
                        style={{
                          fontSize: 10,
                          color: 'var(--text3)',
                          padding: '0 4px',
                          fontStyle: 'italic',
                          cursor: meta.savedMemories?.length ? 'help' : 'default',
                        }}
                      >
                        {meta.savedMemories?.length ? `✓ 覚えておきました（${meta.savedMemories.length}件）` : ''}
                        {meta.forgottenMemories ? `${meta.savedMemories?.length ? ' · ' : ''}忘れました（${meta.forgottenMemories}件）` : ''}
                      </div>
                    ) : null}
                  </div>
                )
              })}
              {sending && (
                <div style={{ alignSelf: 'flex-start', fontSize: 11, color: 'var(--text3)', padding: '4px 6px' }}>
                  考え中...
                </div>
              )}
            </div>
          )}

          <textarea
            className="input"
            placeholder="今の気持ちを書いてください（Cmd/Ctrl+Enterで送信）"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={sending}
            style={{ width: '100%', boxSizing: 'border-box', minHeight: 60, fontSize: 13, resize: 'vertical' }}
          />

          {error && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{error}</div>}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 11, padding: '4px 10px', textTransform: 'none', letterSpacing: 0 }}
              onClick={() => {
                setExpanded(false)
                setInput('')
                setError(null)
              }}
            >
              閉じる
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={send}
              disabled={!input.trim() || sending}
              style={{ fontSize: 12, padding: '5px 14px' }}
            >
              送信
            </button>
          </div>
        </div>
      )}

      {children}
    </Card>
  )
}
