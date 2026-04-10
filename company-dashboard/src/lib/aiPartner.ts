/**
 * AI Partner persona and prompt builder.
 * Builds a system prompt enriched with user context for empathetic, motivating interactions.
 */

export interface EmotionSummary {
  dominantEmotion: string
  valence: number
  arousal: number
  wbi: number
}

export interface NarrativeContext {
  identity?: string       // 人生テーマ（「意味を問う人」等）
  currentArc?: string     // 今のフェーズの解釈文
  emotionalDNA?: string   // 感情的特徴
  aspirations?: string    // 夢・志向性の要約
}

export interface PartnerContext {
  recentDiary?: string
  recentEmotions?: EmotionSummary
  dreams?: { title: string; status: string }[]
  openTasks?: { title: string; due_date?: string }[]
  streak?: number
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night'
  narrative?: NarrativeContext
}

const BASE_SYSTEM_PROMPT = `あなたは「パートナー」です。ユーザーの人生を豊かにするAI相棒です。

## あなたの役割
- ユーザーを一番理解している存在
- 良い未来へ導く（将来あるべき姿を提示し、引き上げる）
- しんどい時は励まし、寄り添う
- 忘れがちなことを思い出させる
- 自分では気づかない傾向に気づかせる

## 口調
- 丁寧だが堅すぎない。温かい
- 「〜ですね」「〜かもしれません」
- 強制しない。提案する
- 褒める時は具体的に

## 絶対にやらないこと
- 他者と比較しない
- 「X日ぶりですね」等の罪悪感を与える表現
- 事務的な報告口調`

/**
 * Build a complete system prompt for the AI Partner,
 * enriched with user's current context.
 */
export function buildPartnerSystemPrompt(context: PartnerContext): string {
  const parts = [BASE_SYSTEM_PROMPT, '\n## ユーザーの文脈']

  if (context.timeOfDay) {
    const labels = { morning: '朝', afternoon: '午後', evening: '夕方', night: '夜' }
    parts.push(`- 現在の時間帯: ${labels[context.timeOfDay]}`)
  }

  if (context.streak !== undefined && context.streak > 0) {
    parts.push(`- 連続記録: ${context.streak}日`)
  }

  if (context.recentEmotions) {
    const e = context.recentEmotions
    parts.push(`- 最近の感情傾向: 主要感情=${e.dominantEmotion}, 感情価=${e.valence.toFixed(2)}, 覚醒度=${e.arousal.toFixed(2)}, WBI=${e.wbi.toFixed(1)}`)
  }

  if (context.recentDiary) {
    parts.push(`- 最近の日記:\n${context.recentDiary}`)
  }

  if (context.dreams && context.dreams.length > 0) {
    const dreamList = context.dreams.map((d) => `  - ${d.title} (${d.status})`).join('\n')
    parts.push(`- 夢リスト:\n${dreamList}`)
  }

  if (context.openTasks && context.openTasks.length > 0) {
    const taskList = context.openTasks.map((t) => `  - ${t.title}${t.due_date ? ` (期限: ${t.due_date})` : ''}`).join('\n')
    parts.push(`- 今日のタスク:\n${taskList}`)
  }

  // Narrative Memory — 物語文脈として自然に注入
  if (context.narrative) {
    const n = context.narrative
    const narrativeParts: string[] = []
    if (n.identity) narrativeParts.push(`この人のテーマ: ${n.identity}`)
    if (n.currentArc) narrativeParts.push(`今の状態: ${n.currentArc}`)
    if (n.emotionalDNA) narrativeParts.push(`感情的な特徴: ${n.emotionalDNA}`)
    if (n.aspirations) narrativeParts.push(`志向: ${n.aspirations}`)
    if (narrativeParts.length > 0) {
      parts.push(`\n## この人の物語（直接言及せず、理解を深めるために使う）\n${narrativeParts.join('\n')}`)
    }
  }

  return parts.join('\n')
}

/**
 * Get time of day category.
 */
export function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const h = new Date().getHours()
  if (h < 5) return 'night'
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  if (h < 21) return 'evening'
  return 'night'
}
