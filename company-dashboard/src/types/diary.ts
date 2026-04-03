export interface DiaryEntry {
  id: string
  body: string
  entry_type: string | null
  entry_date: string | null
  mood_score: number | null
  wbi: number | null
  emotions: Record<string, unknown> | null
  ai_summary: string | null
  created_at: string
}

export interface EmotionAnalysis {
  id: string
  diary_entry_id: string
  joy: number
  trust: number
  fear: number
  surprise: number
  sadness: number
  disgust: number
  anger: number
  anticipation: number
  valence: number
  arousal: number
  perma_p: number
  perma_e: number
  perma_r: number
  perma_m: number
  perma_a: number
  perma_v: number
  wbi_score: number
  model_used: string | null
  created_at: string
}
