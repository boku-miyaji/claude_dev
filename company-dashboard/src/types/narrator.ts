export type StoryMemoryType = 'identity' | 'current_arc' | 'chapter' | 'emotional_dna' | 'aspirations'

export interface StoryMemory {
  id: number
  memory_type: StoryMemoryType
  content: Record<string, unknown>
  narrative_text: string | null
  data_range: string | null // PostgreSQL tstzrange as string
  version: number
  created_at: string
  updated_at: string
}

export type StoryMomentType = 'decision' | 'realization' | 'breakthrough' | 'connection' | 'setback'

export interface StoryMoment {
  id: number
  moment_type: StoryMomentType
  title: string
  description: string | null
  diary_entry_id: number | null
  emotion_snapshot: Record<string, number> | null
  user_confirmed: boolean
  detected_at: string
  created_at: string
}

/** Arc Reader output: current emotional phase */
export type ArcPhase = 'exploration' | 'immersion' | 'reflection' | 'reconstruction' | 'leap'

export interface ArcReaderResult {
  phase: ArcPhase
  narrative: string // 1-2 sentence interpretation
  confidence: number // 0-1
  change_summary?: string // diff from previous (batch-generated, shown in Home banner)
}
