# Google Calendar 認証の迷走 — scope不足→トークン消失→サイレント再取得

- **type**: `failure`
- **date**: 2026-04-02
- **category**: security / **severity**: medium
- **status**: resolved
- **source**: manual
- **tags**: security, oauth, google-calendar, token-management, claude-dev
- **commits**: d212066, 6dd5699

## what_happened
Calendar連携でOAuth scopeが不足→calendar.events.readonlyを追加→しかしトークンが古いscopeのまま→自動クリア機能追加→ページリロードでトークン消失→localStorage保存に変更、と4段階の修正が必要だった。

## root_cause
OAuth認証のスコープ変更時に既存トークンの invalidation と再取得のフローが未設計だった。

## countermeasure
トークンをlocalStorageに永続化 + scope不足検出時の自動クリア + サイレント再取得の3層で解決。

## result
OAuth系の認証は「スコープ変更」「トークン失効」「ストレージ消失」の3つを常に想定して設計する必要がある。

<!-- id: 8717dbe1-c767-47a4-ba00-6a8804b3035a -->
