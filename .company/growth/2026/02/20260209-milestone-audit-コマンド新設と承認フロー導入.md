# audit コマンド新設と承認フロー導入

- **type**: `milestone`
- **date**: 2026-02-09
- **category**: tooling / **severity**: medium
- **status**: active
- **source**: backfill
- **tags**: audit, approval-gate, docs-consistency, claude-dev
- **commits**: 98084b0, 49e7796

## what_happened
docs/code の構造・整合性をチェックする audit コマンドを新規追加。初版の後、自動修正ではなくユーザー承認を必須とするフローに改訂し、冗長性分析機能も追加した。

## root_cause
ドキュメントとコードの不整合を検出する仕組みが不足していた。また自動修正は破壊的リスクがあるため承認ゲートが必要と判断。

## countermeasure
audit.md を新設し、修正前に承認を求める設計に変更。冗長性分析も組み込んだ。

## result
構造チェックの自動化と安全な修正フローを両立。

<!-- id: 820154d7-f24c-4386-b023-8cdff75550ef -->
