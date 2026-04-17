/**
 * Keyboard shortcut definitions — Single Source of Truth.
 * All shortcut handling across the app references this file.
 */

export interface Shortcut {
  key: string
  meta?: boolean      // Cmd (Mac) / Ctrl (Win)
  shift?: boolean
  alt?: boolean
  label: string
  description: string
  scope: 'global' | 'today' | 'calendar'
}

/** Cmd+1〜9 navigates to these pages (sidebar order) */
export const NAV_SHORTCUTS: string[] = [
  '/',            // 1 = Home (Today)
  '/journal',     // 2 = Journal
  '/requests',    // 3 = Requests
  '/calendar',    // 4 = Calendar
  '/dreams',      // 5 = Dreams & Goals
  '/habits',      // 6 = Habits
  '/insights',    // 7 = Insights
  '/intelligence', // 8 = News
  '/story',       // 9 = Story
]

export const ALL_SHORTCUTS: Shortcut[] = [
  // ── Global ──
  { key: 'k', meta: true, label: 'Cmd+K', description: 'コマンドパレット', scope: 'global' },
  { key: 's', meta: true, shift: true, label: 'Cmd+Shift+S', description: 'サイドバー開閉', scope: 'global' },
  { key: '/', meta: true, label: 'Cmd+/', description: 'ショートカット一覧', scope: 'global' },
  { key: 'Escape', label: 'Esc', description: 'キャンセル / モーダルを閉じる / 生成中断', scope: 'global' },
  // Cmd+1〜9 = ページ移動
  ...NAV_SHORTCUTS.map((_, i) => ({
    key: String(i + 1),
    meta: true,
    label: `Cmd+${i + 1}`,
    description: `${['Home', 'Journal', 'Requests', 'Calendar', 'Dreams', 'Habits', 'Insights', 'News', 'Story'][i]} に移動`,
    scope: 'global' as const,
  })),

  // ── Common input ──
  { key: 'Enter', meta: true, label: 'Cmd+Enter', description: '送信 / 保存', scope: 'global' },

  // ── Today ──
  { key: 't', meta: true, shift: true, label: 'Cmd+Shift+T', description: 'タスクを追加', scope: 'today' },
  { key: 'd', meta: true, shift: true, label: 'Cmd+Shift+D', description: '日記入力欄にフォーカス', scope: 'today' },

  // ── Calendar ──
  { key: 'n', meta: true, shift: true, label: 'Cmd+Shift+N', description: '新しい予定を作成', scope: 'calendar' },
  { key: 'ArrowLeft', label: '←', description: '前の期間', scope: 'calendar' },
  { key: 'ArrowRight', label: '→', description: '次の期間', scope: 'calendar' },
  { key: 't', label: 'T', description: '今日に戻る', scope: 'calendar' },
]

/** Check if a KeyboardEvent matches a shortcut definition */
export function matchesShortcut(e: KeyboardEvent, s: Shortcut): boolean {
  if (s.meta && !(e.metaKey || e.ctrlKey)) return false
  if (s.shift && !e.shiftKey) return false
  if (s.alt && !e.altKey) return false
  if (!s.meta && (e.metaKey || e.ctrlKey)) return false
  if (!s.shift && e.shiftKey) return false
  return e.key === s.key || e.key.toLowerCase() === s.key.toLowerCase()
}

/** Get shortcuts for a specific scope */
export function getShortcutsForScope(scope: Shortcut['scope']): Shortcut[] {
  return ALL_SHORTCUTS.filter((s) => s.scope === scope)
}

/** Human-readable modifier prefix */
export function formatShortcut(s: Shortcut): string {
  return s.label
}

/** Is the user typing in an input/textarea? (don't intercept single-key shortcuts) */
export function isTyping(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || (el as HTMLElement).isContentEditable
}
