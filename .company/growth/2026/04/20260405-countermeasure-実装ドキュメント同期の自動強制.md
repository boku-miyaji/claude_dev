# 実装↔ドキュメント同期の自動強制

- **type**: `countermeasure`
- **date**: 2026-04-05
- **category**: automation / **severity**: medium
- **status**: active
- **source**: backfill
- **tags**: hooks, docs-sync, automation
- **commits**: 0c06975, 42bdfe6, 42a5ea6, 1fd2a93

## what_happened
実装変更時にドキュメント更新が漏れる問題に対し、SessionStartでのdoc-freshness-check、PostToolUseでのdocs-sync-guardを追加し、コード変更ファイルと対応するドキュメントセクションの同期を自動チェックする仕組みを導入。

## root_cause
How It Works等の説明ドキュメントが実装から乖離しがちだった

## countermeasure
hook 2種 + commit-rules.mdに同期必須マッピングを追記

## result
実装変更時に自動警告が出るようになった

<!-- id: 5b222d07-91a3-44cb-bdb9-e2099d57f356 -->
