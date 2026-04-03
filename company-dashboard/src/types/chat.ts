export interface ChatState {
  conversationId: string | null
  conversations: Conversation[]
  model: string
  contextMode: 'full' | 'none' | 'company'
  companyId: string | null
  streaming: boolean
  directMode: boolean
  reasoningEffort: 'auto' | 'low' | 'medium' | 'high'
  precisionMode: boolean
}

export interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at: string
  message_count?: number
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  model?: string
  tokens_in?: number
  tokens_out?: number
  cost?: number
  created_at: string
}
