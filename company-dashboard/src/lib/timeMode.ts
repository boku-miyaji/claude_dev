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

/** Diary input prompt based on time and context */
export function getDiaryPrompt(
  mode: TimeMode,
  recentEventName?: string,
): string {
  if (mode === 'afternoon' && recentEventName) {
    return `${recentEventName}の後、何か思ったことは?`
  }
  switch (mode) {
    case 'morning': return '今日やりたいことは?'
    case 'afternoon': return '今、頭に浮かんでいることは?'
    case 'evening': {
      const prompts = [
        '今日一番印象に残ったことは何ですか?',
        '今日の自分に点数をつけるなら?',
        '今日「ありがとう」と思った瞬間は?',
        '明日の自分に一言伝えるなら?',
        '今日学んだことは?',
      ]
      return prompts[new Date().getDate() % prompts.length]
    }
  }
}
