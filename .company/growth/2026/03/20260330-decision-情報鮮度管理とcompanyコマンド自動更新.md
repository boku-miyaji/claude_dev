# 情報鮮度管理とcompanyコマンド自動更新

- **type**: `decision`
- **date**: 2026-03-30
- **category**: automation / **severity**: medium
- **status**: active
- **source**: llm-retroactive
- **tags**: claude-dev, automation, operations, llm-retroactive, llm-classified

## what_happened
システムが管理する情報の鮮度バラつきを受け、各情報源の更新頻度・優先度を定義。/companyコマンド起動時に適切なタイミングで自動更新を走らせる方針を決定。how-it-works(Blueprint)に起点を整理。

## result
freshness-policy.yaml と自動メンテナンス機構の基盤となる方針として確立。

<!-- id: 1da067aa-5954-43c6-b06e-3ed97cb954cd -->
