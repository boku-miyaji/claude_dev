# Blueprint更新はタスク化時に事前チェック

- **type**: `countermeasure`
- **date**: 2026-04-07
- **category**: process / **severity**: medium
- **status**: active
- **source**: llm-retroactive
- **tags**: claude-dev, hook, documentation, llm-retroactive, llm-classified

## what_happened
docs-sync-guard等のhookで作業後に警告を出しても気づかず見落とされる課題があった。対策として、作業終了後ではなくTodoWriteでタスク化する初期段階で「Blueprint更新確認」を必ず含めるワークフローに変更。

## root_cause
作業完了後のhook警告は認知負荷が高くスルーされやすい

## countermeasure
TodoWrite作成時に最終ステップへ「Blueprint更新確認」を必ず含めるルール化（CLAUDE.mdに明記）

<!-- id: c6b8112f-c0e1-4423-8c2d-89eccf69c6d1 -->
