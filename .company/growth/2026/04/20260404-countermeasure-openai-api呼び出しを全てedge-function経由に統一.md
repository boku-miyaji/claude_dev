# OpenAI API呼び出しを全てEdge Function経由に統一

- **type**: `countermeasure`
- **date**: 2026-04-04
- **category**: architecture / **severity**: high
- **status**: active
- **source**: backfill
- **tags**: security, edge-function, openai, claude-dev
- **commits**: f6bdc22, 5351385

## what_happened
ブラウザから直接OpenAI APIを叩いていた箇所をEdge Function経由にルーティング統一。自動化された呼び出しがjunk conversationを生成する問題も同時に修正。

## root_cause
ブラウザ直叩きはキー露出と課金管理が難しく、共通化できていなかった

## countermeasure
edgeAi.ts の aiCompletion() に集約し、全呼び出しを経由させる

## result
API呼び出しの一元管理とセキュリティ向上

<!-- id: 4ee46828-c4db-431f-a8a0-7fe30639b8aa -->
