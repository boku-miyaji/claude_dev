import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { renderMarkdownSafe } from '@/lib/markdown'
import { extractTextFromFile } from '@/lib/fileExtract'
import { toast } from '@/components/ui'

const EDGE_FN_URL = import.meta.env.VITE_SUPABASE_URL + '/functions/v1/ai-agent'
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// ============================================================
// Types
// ============================================================

interface Conversation { id: string; title: string; model: string; company_id: string | null; updated_at: string }
interface Message { id?: string; role: 'user' | 'assistant' | 'tool'; content: string; model?: string; tokens_input?: number; tokens_output?: number; cost_usd?: number; step?: number; tool_name?: string; tool_input?: string }
interface Attachment { name: string; type: string; dataUrl: string; base64?: string; textContent?: string; size: number; extracting?: boolean }
interface ChatSettings { model: string; reasoningEffort: string; contextMode: string; precisionMode: boolean; directMode: boolean }
interface ToolInfo { name: string; start: number; duration_ms: number | null; input_summary: string }

function getChatApiKey(): string { return localStorage.getItem('hd-chat-api-key') || '' }
function setChatApiKey(key: string) { localStorage.setItem('hd-chat-api-key', key) }

// ============================================================
// Markdown renderer (safe DOM insertion)
// Sanitized by renderMarkdownSafe which strips script tags and on* handlers
// ============================================================

function MarkdownContent({ text }: { text: string }) {
  const html = useMemo(() => renderMarkdownSafe(text), [text])
  // eslint-disable-next-line react/no-danger -- sanitized by renderMarkdownSafe
  return <div className="md-body" dangerouslySetInnerHTML={{ __html: html }} />
}

// ============================================================
// Message components
// ============================================================

function UserMessage({ text, attachments, onEdit }: { text: string; attachments?: Attachment[]; onEdit?: (text: string) => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div className="chat-msg-row user" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', gap: 2, alignItems: 'center', opacity: hovered ? 1 : 0, transition: 'opacity .15s', paddingTop: 8 }}>
          {onEdit && text && (
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 4, fontSize: 13, color: 'var(--text3)' }}
              title="編集して再送信" onClick={() => onEdit(text)}>✎</button>
          )}
        </div>
        <div className="chat-bubble">
          {text && <div style={{ whiteSpace: 'pre-wrap' }}>{text}</div>}
          {attachments && attachments.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {attachments.map((att, i) => att.type.startsWith('image/')
                ? <img key={i} src={att.dataUrl} style={{ maxWidth: 200, maxHeight: 150, borderRadius: 8, cursor: 'pointer' }} onClick={() => window.open(att.dataUrl, '_blank')} />
                : <div key={i} style={{ padding: '4px 8px', background: 'var(--surface2)', borderRadius: 4, fontSize: 11 }}>{att.name}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AssistantMessage({ text, model, cost, step }: { text: string; model?: string; tokIn?: number; tokOut?: number; cost?: number; step?: number }) {
  const [hovered, setHovered] = useState(false)
  const [copied, setCopied] = useState(false)
  const meta = [model || '', step ? `Step ${step}` : '', cost ? `${(cost * 150).toFixed(1)}円` : ''].filter(Boolean).join(' · ')
  return (
    <div className="chat-msg-row assistant" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="chat-bubble">
        {meta && <div className="chat-meta">{meta}</div>}
        <MarkdownContent text={text || ''} />
        <div style={{ display: 'flex', gap: 4, marginTop: 8, opacity: hovered ? 1 : 0, transition: 'opacity .15s' }}>
          <button style={{ background: 'none', border: '1px solid var(--border)', cursor: 'pointer', padding: '3px 8px', borderRadius: 4, fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font)' }}
            onClick={() => { navigator.clipboard.writeText(text || ''); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>
            {copied ? '✓ Copied' : '📋 Copy'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ToolMessage({ toolName, result }: { toolName: string; result: string }) {
  return (
    <div className="chat-msg-row assistant">
      <div className="chat-tool-block">
        <span className="tool-icon">🔧</span>
        <span className="tool-name">{toolName}</span>
        <span className="tool-summary">{(result || '').substring(0, 80)}</span>
      </div>
    </div>
  )
}

// ============================================================
// Activity block (tool usage during streaming)
// ============================================================

function ActivityBlock({ tools, elapsed }: { tools: ToolInfo[]; elapsed?: string }) {
  const [expanded, setExpanded] = useState(false)
  if (tools.length === 0) return null
  const label = elapsed ? `${tools.length}件検索 · ${elapsed}s` : `${tools[tools.length - 1].name} を検索中...`
  return (
    <div className="chat-msg-row assistant">
      <div style={{ margin: '4px 0' }}>
        <div className="chat-activity-block" style={{ fontSize: 11, color: 'var(--text3)', padding: '6px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => setExpanded(e => !e)}>
          <span style={{ fontSize: 12 }}>⚙</span>
          <span>{label}</span>
        </div>
        {expanded && (
          <div style={{ padding: '6px 0 2px', fontSize: 11, color: 'var(--text3)', borderTop: '1px solid var(--border)', marginTop: 4 }}>
            {tools.map((t, i) => (
              <div key={i} style={{ padding: '2px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--accent)' }}>🔧</span>
                <span style={{ fontWeight: 500 }}>{t.name}</span>
                <span style={{ color: 'var(--text3)' }}>{t.input_summary.substring(0, 50)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Streaming message (during SSE)
// ============================================================

function StreamingMessage({ text, meta, thinkingText }: { text: string; meta: string; thinkingText: string }) {
  return (
    <div className="chat-msg-row assistant">
      <div className="chat-bubble">
        <div className="chat-meta">{meta}</div>
        {text ? <MarkdownContent text={text} /> : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text3)', fontSize: 12 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
            <span>{thinkingText}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Attachment preview
// ============================================================

function AttachmentPreview({ attachments, onRemove }: { attachments: Attachment[]; onRemove: (idx: number) => void }) {
  if (attachments.length === 0) return null
  return (
    <div className="chat-attach-preview">
      {attachments.map((att, idx) => {
        let label = att.name.length > 20 ? att.name.substring(0, 17) + '...' : att.name
        if (att.extracting) label += ' (抽出中...)'
        else if (att.textContent && att.textContent.length > 50) label += ` (✓ ${Math.round(att.textContent.length / 1000)}KB)`
        const ext = att.name.split('.').pop()?.toLowerCase() || ''
        const ficon: Record<string, string> = { pdf: '📄', xlsx: '📊', xls: '📊', pptx: '📝', ppt: '📝', docx: '📃', doc: '📃' }
        return (
          <div key={idx} className="chat-attach-pill">
            {att.type.startsWith('image/') ? <img src={att.dataUrl} /> : <span style={{ fontSize: 16 }}>{ficon[ext] || '📁'}</span>}
            <span>{label}</span>
            <span className="remove" onClick={() => onRemove(idx)}>×</span>
          </div>
        )
      })}
    </div>
  )
}

// ============================================================
// Sidebar
// ============================================================

function ChatSidebar({ conversations, activeId, searchQuery, onSearch, onSelect, onNew, onArchive, collapsed }: {
  conversations: Conversation[]; activeId: string | null; searchQuery: string
  onSearch: (q: string) => void; onSelect: (id: string) => void; onNew: () => void; onArchive: (id: string) => void; collapsed: boolean
}) {
  const filtered = searchQuery ? conversations.filter(c => (c.title || '').toLowerCase().includes(searchQuery.toLowerCase())) : conversations

  const now = new Date()
  const todayStr = now.toISOString().substring(0, 10)
  const yesterdayStr = new Date(now.getTime() - 86400000).toISOString().substring(0, 10)
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)); weekStart.setHours(0, 0, 0, 0)
  const weekStartStr = weekStart.toISOString().substring(0, 10)
  const monthStartStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().substring(0, 10)

  const groups = useMemo(() => {
    const g = { today: [] as Conversation[], yesterday: [] as Conversation[], thisWeek: [] as Conversation[], thisMonth: [] as Conversation[], older: [] as Conversation[] }
    filtered.forEach(c => {
      const d = (c.updated_at || '').substring(0, 10)
      if (d === todayStr) g.today.push(c)
      else if (d === yesterdayStr) g.yesterday.push(c)
      else if (d >= weekStartStr) g.thisWeek.push(c)
      else if (d >= monthStartStr) g.thisMonth.push(c)
      else g.older.push(c)
    })
    return g
  }, [filtered, todayStr, yesterdayStr, weekStartStr, monthStartStr])

  const renderGroup = (label: string, items: Conversation[]) => {
    if (items.length === 0) return null
    return (
      <div key={label}>
        <div className="chat-group-label">{label}</div>
        {items.map(c => (
          <ConvItem key={c.id} conv={c} active={c.id === activeId} onSelect={onSelect} onArchive={onArchive} />
        ))}
      </div>
    )
  }

  return (
    <div className={'chat-sidebar' + (collapsed ? ' collapsed' : '')}>
      <div className="chat-sidebar-header">
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--font)', padding: '4px 0', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}
          onClick={() => { window.location.hash = '/' }}>← Home</button>
        <button className="btn btn-primary" style={{ width: '100%', fontSize: 13, borderRadius: 'var(--r2)' }} onClick={onNew}>+ New Chat</button>
      </div>
      <div className="chat-sidebar-list">
        <input className="input" placeholder="検索..." value={searchQuery} onChange={e => onSearch(e.target.value)}
          style={{ fontSize: 12, padding: '6px 10px', marginBottom: 8, width: '100%', boxSizing: 'border-box' }} />
        {renderGroup('Today', groups.today)}
        {renderGroup('Yesterday', groups.yesterday)}
        {renderGroup('This Week', groups.thisWeek)}
        {renderGroup('This Month', groups.thisMonth)}
        {renderGroup('Older', groups.older)}
        {filtered.length === 0 && searchQuery && (
          <div style={{ padding: 12, fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>該当なし</div>
        )}
      </div>
    </div>
  )
}

function ConvItem({ conv, active, onSelect, onArchive }: { conv: Conversation; active: boolean; onSelect: (id: string) => void; onArchive: (id: string) => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div className={'chat-conv-item' + (active ? ' active' : '')} style={{ display: 'flex', alignItems: 'center', gap: 4 }}
      onClick={() => onSelect(conv.id)} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <span className="chat-conv-title" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.title || 'Untitled'}</span>
      <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--text3)', padding: '2px 4px', opacity: hovered ? 1 : 0, transition: 'opacity .2s' }}
        title="アーカイブ" onClick={e => { e.stopPropagation(); onArchive(conv.id) }}>✕</button>
    </div>
  )
}

// ============================================================
// Main Chat Page
// ============================================================

export function Chat() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [settings, setSettings] = useState<ChatSettings>({ model: 'auto', reasoningEffort: 'auto', contextMode: 'full', precisionMode: false, directMode: false })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(window.innerWidth <= 768)
  const [searchQuery, setSearchQuery] = useState('')
  const [showOptions, setShowOptions] = useState(false)
  const [inputText, setInputText] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [streaming, setStreaming] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [streamMeta, setStreamMeta] = useState('')
  const [streamThinking, setStreamThinking] = useState('考え中...')
  const [streamTools, setStreamTools] = useState<ToolInfo[]>([])
  const [streamElapsed, setStreamElapsed] = useState<string | undefined>(undefined)

  const abortRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const autoScrollRef = useRef(true)
  const messagesAreaRef = useRef<HTMLDivElement>(null)

  // Load conversations on mount
  useEffect(() => {
    (async () => {
      // Detect direct mode
      let directMode = false
      if (!getChatApiKey()) {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          const res = await fetch(EDGE_FN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || ''}`, 'apikey': ANON_KEY },
            body: JSON.stringify({ message: 'ping', model: 'gpt-5-nano', context_mode: 'none' }),
          })
          if (!res.ok) directMode = true
        } catch { directMode = true }
      } else { directMode = true }
      setSettings(s => ({ ...s, directMode }))

      const { data } = await supabase.from('conversations').select('id,title,model,company_id,updated_at').eq('archived', false).order('updated_at', { ascending: false }).limit(50)
      setConversations(data || [])

      // Check hash for conversation ID
      const hashParts = (window.location.hash || '').replace('#', '').split('/')
      if (hashParts[0] === 'chat' && hashParts[1]) {
        setConversationId(hashParts[1])
      }
    })()
  }, [])

  // Load messages when conversation changes
  useEffect(() => {
    if (!conversationId) {
      setMessages([])
      window.location.hash = 'chat'
      return
    }
    window.location.hash = `chat/${conversationId}`;
    (async () => {
      const { data } = await supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true })
      setMessages((data || []) as Message[])
    })()
  }, [conversationId])

  // Auto scroll
  useEffect(() => {
    if (autoScrollRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, streamText])

  const scrollHandler = useCallback(() => {
    const el = messagesAreaRef.current
    if (!el) return
    autoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
  }, [])

  // File attachment handler
  const addFileAttachment = useCallback((f: File) => {
    const isText = /\.(txt|md|csv|json|yaml|yml|xml|html|css|js|ts|py|sql)$/i.test(f.name)
    const isExtractable = /\.(pdf|xlsx|xls|docx|pptx)$/i.test(f.name)
    if (isText) {
      const reader = new FileReader()
      reader.onload = (e) => {
        let content = e.target?.result as string
        if (content.length > 50000) content = content.substring(0, 50000) + '\n...(truncated)'
        setAttachments(prev => [...prev, { name: f.name, type: f.type, dataUrl: '', textContent: content, size: f.size }])
      }
      reader.readAsText(f)
    } else if (isExtractable) {
      setAttachments(prev => [...prev, { name: f.name, type: f.type, dataUrl: '', textContent: '[抽出中...]', size: f.size, extracting: true }])
      extractTextFromFile(f).then(text => {
        setAttachments(prev => prev.map(a => a.name === f.name && a.extracting ? { ...a, textContent: text || '[テキスト抽出失敗]', extracting: false } : a))
      })
    } else {
      const reader = new FileReader()
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string
        setAttachments(prev => [...prev, { name: f.name, type: f.type, dataUrl, base64: dataUrl.split(',')[1], size: f.size }])
      }
      reader.readAsDataURL(f)
    }
  }, [])

  // Send message
  const sendMessage = useCallback(async () => {
    const text = inputText.trim()
    const atts = [...attachments]
    if ((!text && !atts.length) || streaming) return
    if (attachments.some(a => a.extracting)) { toast('ファイル抽出中です...しばらくお待ちください'); return }

    setInputText('')
    setAttachments([])
    setStreaming(true)
    setStreamText('')
    setStreamMeta('')
    setStreamThinking('考え中...')
    setStreamTools([])
    setStreamElapsed(undefined)
    autoScrollRef.current = true

    const userMsg: Message = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])

    const abort = new AbortController()
    abortRef.current = abort
    const startTime = Date.now()
    let ttft: number | null = null
    let fullText = ''
    let finalMeta = ''
    const toolsUsed: ToolInfo[] = []
    let currentConvId = conversationId
    let metricsModel = ''
    let metricsComplexity = ''
    let stepCount = 0
    let tokIn = 0, tokOut = 0, costUsd = 0

    try {
      if (settings.directMode && getChatApiKey()) {
        // ========== Direct Mode ==========
        const apiKey = getChatApiKey()
        const model = settings.model === 'auto' ? 'gpt-5-nano' : settings.model
        metricsModel = model
        setStreamMeta(`Direct · ${model}`)

        let sysPrompt = "You are the user's personal AI assistant. You know them deeply. Respond in their language. Use Markdown."
        try {
          const { data: us } = await supabase.from('user_settings').select('chat_nickname,chat_occupation,chat_about,chat_style,chat_custom_instructions').limit(1).single()
          if (us) {
            if (us.chat_nickname || us.chat_occupation) sysPrompt += `\n\nAbout the user: ${[us.chat_nickname ? 'Name: ' + us.chat_nickname : '', us.chat_occupation ? 'Occupation: ' + us.chat_occupation : '', us.chat_about || ''].filter(Boolean).join('. ')}`
            if (us.chat_custom_instructions) sysPrompt += `\n\nCustom instructions: ${us.chat_custom_instructions}`
          }
          const { data: kb } = await supabase.from('knowledge_base').select('rule,category').eq('status', 'active').gte('confidence', 2).order('confidence', { ascending: false }).limit(10)
          if (kb?.length) sysPrompt += '\n\nKnowledge rules (apply silently):\n' + kb.map(r => `- [${r.category}] ${r.rule}`).join('\n')
        } catch { /* skip personalization */ }

        const oaiMessages: Array<{ role: string; content: unknown }> = [{ role: 'system', content: sysPrompt }]
        if (currentConvId) {
          const { data: hist } = await supabase.from('messages').select('role,content').eq('conversation_id', currentConvId).order('created_at', { ascending: true }).limit(20)
          hist?.forEach(m => { if (m.role === 'user' || m.role === 'assistant') oaiMessages.push({ role: m.role, content: m.content || '' }) })
        }

        const imageAtts = atts.filter(a => a.type.startsWith('image/'))
        const fileAtts = atts.filter(a => !a.type.startsWith('image/'))
        let fileContext = ''
        fileAtts.forEach(f => { fileContext += f.textContent ? `\n\n--- File: ${f.name} ---\n${f.textContent}` : `\n\n[Attached: ${f.name}]` })

        if (imageAtts.length > 0) {
          const parts: unknown[] = [{ type: 'text', text: text + fileContext }]
          imageAtts.forEach(img => { parts.push({ type: 'image_url', image_url: { url: img.dataUrl, detail: 'auto' } }) })
          oaiMessages.push({ role: 'user', content: parts })
        } else {
          oaiMessages.push({ role: 'user', content: text + fileContext })
        }

        if (!currentConvId) {
          const { data: ci } = await supabase.from('conversations').insert({ title: text.substring(0, 40), model, context_mode: 'none' }).select('id').single()
          if (ci) { currentConvId = ci.id; setConversationId(ci.id) }
        }
        if (currentConvId) await supabase.from('messages').insert({ conversation_id: currentConvId, role: 'user', content: text, step: 0 })

        const re = settings.reasoningEffort === 'auto' ? (model === 'gpt-5-nano' ? 'none' : model === 'gpt-5-mini' ? 'low' : 'medium') : settings.reasoningEffort
        const body: Record<string, unknown> = { model, messages: oaiMessages, stream: true, stream_options: { include_usage: true } }
        if (re && re !== 'none') body.reasoning_effort = re

        const res = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }, body: JSON.stringify(body), signal: abort.signal })
        if (!res.ok) { setStreamText(`Error ${res.status}`); setStreaming(false); return }

        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n'); buf = lines.pop() || ''
          for (const line of lines) {
            if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
            try {
              const d = JSON.parse(line.slice(6))
              if (d.usage) { tokIn = d.usage.prompt_tokens || 0; tokOut = d.usage.completion_tokens || 0 }
              const delta = d.choices?.[0]?.delta
              if (delta?.content) {
                if (!ttft) ttft = Date.now() - startTime
                fullText += delta.content
                setStreamText(fullText)
              }
            } catch { /* skip */ }
          }
        }
        stepCount = 1
        finalMeta = `${model} · ${tokIn + tokOut} tok`
        setStreamMeta(finalMeta)

        if (currentConvId && fullText) {
          await supabase.from('messages').insert({ conversation_id: currentConvId, role: 'assistant', content: fullText, model, tokens_input: tokIn, tokens_output: tokOut, step: 1 })
          await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', currentConvId)
        }
      } else {
        // ========== Edge Function Mode ==========
        const images = atts.filter(a => a.type.startsWith('image/')).map(a => ({ data_url: a.dataUrl, name: a.name, type: a.type }))
        const fileAtts = atts.filter(a => !a.type.startsWith('image/'))
        let fileContext = ''
        fileAtts.forEach(f => { fileContext += (f.textContent && f.textContent.length > 10) ? `\n\n--- File: ${f.name} ---\n${f.textContent}` : `\n\n[Attached: ${f.name}]` })

        const refreshed = await supabase.auth.refreshSession()
        const session = refreshed.data.session ? refreshed : await supabase.auth.getSession()
        const token = session.data.session?.access_token || ''

        const res = await fetch(EDGE_FN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'apikey': ANON_KEY },
          body: JSON.stringify({
            conversation_id: currentConvId, message: text, file_context: fileContext || undefined,
            model: settings.model, context_mode: settings.contextMode, company_id: null,
            reasoning_effort: settings.reasoningEffort, images: images.length ? images : undefined,
            precision_mode: settings.precisionMode || undefined,
          }),
          signal: abort.signal,
        })

        if (!res.ok) {
          if (res.status === 401) {
            setStreamText('Edge Function 認証エラー (401): OpenAI API Key が未設定の可能性があります。')
            setSettings(s => ({ ...s, directMode: true }))
          } else {
            setStreamText(`Edge Function error: HTTP ${res.status}`)
          }
          setStreaming(false); return
        }

        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n'); buf = lines.pop() || ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const evt = JSON.parse(line.slice(6))
              switch (evt.type) {
                case 'conversation':
                  currentConvId = evt.id; setConversationId(evt.id); break
                case 'routing':
                  setStreamMeta(evt.status === 'classifying' ? 'Routing...' : evt.model)
                  setStreamThinking(evt.status === 'classifying' ? '分類中...' : '考え中...')
                  if (evt.model) metricsModel = evt.model
                  if (evt.complexity) metricsComplexity = evt.complexity
                  break
                case 'step_start':
                  setStreamMeta(evt.model)
                  setStreamThinking(evt.step > 1 ? '結果をまとめています...' : '考え中...')
                  stepCount = evt.step
                  break
                case 'delta':
                  if (!ttft) ttft = Date.now() - startTime
                  fullText += evt.content
                  setStreamText(fullText)
                  break
                case 'tool_start':
                  toolsUsed.push({ name: evt.tool, start: Date.now(), duration_ms: null, input_summary: JSON.stringify(evt.input).substring(0, 80) })
                  setStreamTools([...toolsUsed])
                  setStreamThinking(`${evt.tool} を実行中...`)
                  break
                case 'tool_result': {
                  const last = toolsUsed[toolsUsed.length - 1]
                  if (last) last.duration_ms = Date.now() - last.start
                  setStreamTools([...toolsUsed])
                  break
                }
                case 'done': {
                  tokIn = evt.tokensInput; tokOut = evt.tokensOutput; costUsd = evt.costUsd
                  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
                  finalMeta = `${evt.model} · ${((evt.costUsd || 0) * 150).toFixed(1)}円 · ${elapsed}s`
                  setStreamMeta(finalMeta)
                  setStreamElapsed(elapsed)
                  const { data: cr } = await supabase.from('conversations').select('id,title,model,company_id,updated_at').eq('archived', false).order('updated_at', { ascending: false }).limit(50)
                  setConversations(cr || [])
                  break
                }
                case 'error':
                  setStreamText(`Error: ${evt.message}`)
                  console.error('[AI Chat Error]', evt.message, evt.stack)
                  break
                case 'max_steps':
                  setStreamMeta(`上限到達（${evt.step}回）`)
                  break
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setStreamText(`Error: ${err.message}`)
      }
    }

    // Finalize
    const totalTime = Date.now() - startTime
    supabase.from('execution_metrics').insert({
      source: 'ai_chat', time_to_first_token_ms: ttft, total_time_ms: totalTime,
      model: metricsModel, reasoning_effort: settings.reasoningEffort,
      routing_complexity: metricsComplexity || null,
      tools_used: toolsUsed.length ? toolsUsed : null,
      tool_count: toolsUsed.length, step_count: stepCount,
      tokens_input: tokIn, tokens_output: tokOut, cost_usd: costUsd || null,
      conversation_id: currentConvId, prompt_summary: text.substring(0, 100),
    })

    const elapsed = (totalTime / 1000).toFixed(1)
    if (finalMeta && !finalMeta.includes('TTFT')) {
      setStreamMeta(m => `${m} · TTFT:${ttft || '?'}ms · Total:${elapsed}s`)
    }

    if (fullText) {
      setMessages(prev => [...prev, { role: 'assistant', content: fullText, model: metricsModel, tokens_input: tokIn, tokens_output: tokOut, cost_usd: costUsd }])
    }
    setStreamText('')
    setStreaming(false)
    abortRef.current = null

    const { data: cr } = await supabase.from('conversations').select('id,title,model,company_id,updated_at').eq('archived', false).order('updated_at', { ascending: false }).limit(50)
    setConversations(cr || [])
  }, [inputText, attachments, streaming, conversationId, settings])

  const handleNewChat = useCallback(() => { setConversationId(null); setMessages([]) }, [])

  const handleArchive = useCallback(async (id: string) => {
    await supabase.from('conversations').update({ archived: true }).eq('id', id)
    setConversations(prev => prev.filter(c => c.id !== id))
    if (conversationId === id) { setConversationId(null); setMessages([]) }
    toast('アーカイブしました')
  }, [conversationId])

  const handleEdit = useCallback((text: string) => {
    setInputText(text)
    textareaRef.current?.focus()
  }, [])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile()
        if (file) {
          const reader = new FileReader()
          reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string
            setAttachments(prev => [...prev, { name: 'pasted.png', type: file.type, dataUrl, base64: dataUrl.split(',')[1], size: file.size }])
          }
          reader.readAsDataURL(file)
        }
      }
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer?.files) {
      Array.from(e.dataTransfer.files).forEach(addFileAttachment)
    }
  }, [addFileAttachment])

  // Direct mode API key banner
  if (settings.directMode && !getChatApiKey()) {
    return (
      <div className="page" style={{ padding: 24 }}>
        <div style={{ padding: 20, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r2)' }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>OpenAI API Key Required</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>Edge Function unavailable. Enter your OpenAI API key to use Direct Mode.</div>
          <input className="input" type="password" placeholder="sk-..." style={{ maxWidth: 400, marginBottom: 8 }} id="api-key-input" />
          <div><button className="btn btn-primary" onClick={() => {
            const input = document.getElementById('api-key-input') as HTMLInputElement
            if (input?.value.trim()) { setChatApiKey(input.value.trim()); window.location.reload() }
          }}>Save & Start</button></div>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-layout">
      <ChatSidebar conversations={conversations} activeId={conversationId} searchQuery={searchQuery}
        onSearch={setSearchQuery} onSelect={setConversationId} onNew={handleNewChat} onArchive={handleArchive}
        collapsed={sidebarCollapsed} />

      <button style={{
        position: 'absolute', top: 12, left: sidebarCollapsed ? 12 : 272, zIndex: 10,
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6,
        width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, color: 'var(--text3)', transition: 'all .2s', boxShadow: '0 1px 3px rgba(0,0,0,.06)',
      }} onClick={() => setSidebarCollapsed(c => !c)}>☰</button>

      <div className="chat-main" style={{ position: 'relative' }}
        onDragOver={e => e.preventDefault()} onDrop={handleDrop}>

        <div className="chat-messages" ref={messagesAreaRef} onScroll={scrollHandler}>
          <div className="chat-messages-inner">
            {messages.length === 0 && !streaming && !conversationId && (
              <div className="chat-welcome">
                <div className="chat-welcome-icon">◆</div>
                <div className="chat-welcome-title">What can I help with?</div>
                <div className="chat-welcome-sub">Tasks, artifacts, knowledge, diary, web search — 11 tools available</div>
              </div>
            )}
            {messages.map((m, i) => {
              if (m.role === 'user') return <UserMessage key={i} text={m.content} onEdit={handleEdit} />
              if (m.role === 'assistant') return <AssistantMessage key={i} text={m.content} model={m.model} tokIn={m.tokens_input} tokOut={m.tokens_output} cost={m.cost_usd} step={m.step} />
              if (m.role === 'tool') return <ToolMessage key={i} toolName={m.tool_name || ''} result={m.content} />
              return null
            })}
            {streaming && (
              <>
                {streamTools.length > 0 && <ActivityBlock tools={streamTools} elapsed={streamElapsed} />}
                <StreamingMessage text={streamText} meta={streamMeta} thinkingText={streamThinking} />
              </>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="chat-input-area">
          <div className="chat-input-wrap">
            <button style={{ fontSize: 11, padding: '2px 8px', border: '1px solid var(--border)', borderRadius: 4, background: 'transparent', color: showOptions ? 'var(--accent)' : 'var(--text3)', cursor: 'pointer', fontFamily: 'var(--font)', marginBottom: 6 }}
              onClick={() => setShowOptions(o => !o)}>⚙ Options</button>

            {showOptions && (
              <div className="chat-controls" style={{ display: 'flex' }}>
                <select value={settings.model} onChange={e => setSettings(s => ({ ...s, model: e.target.value }))}>
                  <option value="auto">Auto</option><option value="gpt-5-nano">GPT-5 nano</option><option value="gpt-5-mini">GPT-5 mini</option><option value="gpt-5">GPT-5</option>
                </select>
                <select value={settings.reasoningEffort} onChange={e => setSettings(s => ({ ...s, reasoningEffort: e.target.value }))}>
                  <option value="auto">Thinking: Auto</option><option value="none">Thinking: None</option><option value="low">Thinking: Low</option><option value="medium">Thinking: Med</option><option value="high">Thinking: High</option>
                </select>
                <select value={settings.contextMode} onChange={e => setSettings(s => ({ ...s, contextMode: e.target.value }))}>
                  <option value="full">Context: Full</option><option value="supabase">Context: DB</option><option value="none">Context: None</option>
                </select>
                <button style={{ fontSize: 11, padding: '4px 10px', borderRadius: 16, border: '1px solid var(--border)', background: settings.precisionMode ? 'var(--accent)' : 'var(--surface)', color: settings.precisionMode ? '#fff' : 'var(--text2)', cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 600, transition: 'all .15s' }}
                  onClick={() => setSettings(s => {
                    const next = !s.precisionMode
                    return next ? { ...s, precisionMode: true, model: 'gpt-5', reasoningEffort: 'high', contextMode: 'full' } : { ...s, precisionMode: false }
                  })}>{settings.precisionMode ? 'Precision ON' : 'Precision'}</button>
              </div>
            )}

            <AttachmentPreview attachments={attachments} onRemove={idx => setAttachments(prev => prev.filter((_, i) => i !== idx))} />

            <div className="chat-input-box">
              <div style={{ position: 'relative' }}>
                <button className="chat-input-btn attach" title="Attach" onClick={() => fileInputRef.current?.click()}>+</button>
              </div>
              <textarea ref={textareaRef} rows={1} placeholder="Message... (Cmd+Enter で送信)" value={inputText}
                onChange={e => { setInputText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
                onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); sendMessage() } }}
                onPaste={handlePaste} />
              {streaming
                ? <button className="chat-input-btn send" title="Stop" style={{ background: 'var(--red)' }} onClick={() => abortRef.current?.abort()}>■</button>
                : <button className="chat-input-btn send" title="Send" onClick={sendMessage}>↑</button>
              }
            </div>
            <input ref={fileInputRef} type="file" accept="image/*,.pdf,.txt,.md,.csv,.json,.xlsx,.xls,.pptx,.ppt,.docx,.doc,.yaml,.yml,.xml,.html,.css,.js,.ts,.py,.sql" multiple style={{ display: 'none' }}
              onChange={e => { Array.from(e.target.files || []).forEach(addFileAttachment); e.target.value = '' }} />
          </div>
        </div>
      </div>
    </div>
  )
}
