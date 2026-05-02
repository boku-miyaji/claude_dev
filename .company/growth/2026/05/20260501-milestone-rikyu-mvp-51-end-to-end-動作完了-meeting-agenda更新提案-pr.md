# rikyu MVP 5/1 end-to-end 動作完了 — meeting → agenda更新提案 / proposal_story 生成まで全部繋がった

- **type**: `milestone`
- **date**: 2026-05-01
- **category**: architecture / **severity**: low
- **status**: resolved
- **source**: manual
- **tags**: rikyu, azure, fastapi, sqlalchemy, service-bus, openai, backend, deployment

## what_happened
5/1 MVP 完成。/health /me /companies /agendas /key-persons 全 200。POST /meetings → agenda_update_from_meeting job が 3 秒で COMPLETED → ai_update_proposals に更新提案 INSERT。POST /proposals/generate → proposal_story job が 7 秒で COMPLETED → proposal_stories に 3 段構成 story (背景/アプローチ/社内メモ) INSERT。当日デモは curl ベースで実施可能な状態。

## countermeasure
今日のセッションで潰した issue: (1) shebang 絶対パス問題で venv path を /app/.venv に統一、(2) MOCK_JWT_SECRET hardcode → env 経由、(3) Service Bus secret の Endpoint= プレフィックス欠落、(4) raw SQL の bind 変数が VARCHAR と推論されて uuid 列との比較で失敗 → CAST(:x AS uuid) 明示、(5) API が SB enqueue した時点で meeting/job が未 commit の race condition → SB 送信前に明示 commit、(6) gpt-5.x 系で max_tokens が null だと 400 エラー → max_completion_tokens に変更し body から omit。最終的に 13 commits を mvp-v0 ブランチに push、Portal で worker deploy。

## result
5/1 当日のデモ準備完了。Phase 1 残課題: web (Next.js) 実装、Service Principal 発行による完全自動 deploy、Key Vault 移管、ai-proposals → アジェンダ反映ロジック、PostgreSQL パスワード rotate (前セッションでチャットに平文表示)。

<!-- id: 56a9165e-1335-41d6-a43e-63756c694628 -->
