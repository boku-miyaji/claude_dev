/** Time-adaptive mode for Today screen */
export type TimeMode = 'morning' | 'afternoon' | 'evening'

export function getTimeMode(): TimeMode {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 17) return 'afternoon'
  return 'evening'
}

export function getGreeting(mode: TimeMode): string {
  switch (mode) {
    case 'morning': return 'おはようございます'
    case 'afternoon': return 'こんにちは'
    case 'evening': return 'おつかれさまです'
  }
}

export function formatToday(): string {
  const d = new Date()
  const dow = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()]
  return `${d.getMonth() + 1}月${d.getDate()}日（${dow}）`
}

// getDiaryPrompt / getTodayQuestions は src/lib/diaryPrompts.ts に移動
// 良問いライブラリ化（価値観・幸せ・失敗パターン等 7軸構造化）のため
export { getDiaryPrompt, getTodayQuestions } from './diaryPrompts'
