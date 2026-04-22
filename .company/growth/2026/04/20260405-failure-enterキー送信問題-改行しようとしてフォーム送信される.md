# Enterキー送信問題 — 改行しようとしてフォーム送信される

- **type**: `failure`
- **date**: 2026-04-05
- **category**: quality / **severity**: medium
- **status**: resolved
- **source**: manual
- **tags**: quality, ux, keyboard, enter-key, form, claude-dev
- **commits**: f790eeb

## what_happened
テキストエリアでEnterを押すと改行ではなくフォーム送信されてしまう問題。ユーザーの期待は「Enter=改行、Cmd/Ctrl+Enter=送信」。

## root_cause
HTMLフォームのデフォルト動作でEnterがsubmitをトリガーする。textareaのkeydownイベントが適切にハンドリングされていなかった。

## countermeasure
Enter=改行、Cmd/Ctrl+Enter or ボタンクリック=送信に統一。全フォームに適用。

## result
社長の強い要望。フォームのEnterキー動作はユーザーの期待と合わせることが重要。この知見はナレッジとして蓄積済み。

<!-- id: d85fd87e-1eb7-40bd-bde4-18035236cc75 -->
