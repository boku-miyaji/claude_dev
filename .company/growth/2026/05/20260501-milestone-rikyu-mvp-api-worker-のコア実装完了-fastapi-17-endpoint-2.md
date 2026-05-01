# rikyu MVP API + Worker のコア実装完了 (FastAPI + 17 endpoint, 2 job handler, 9 tests passing)

- **type**: `milestone`
- **date**: 2026-05-01
- **category**: architecture / **severity**: low
- **status**: resolved
- **source**: manual
- **tags**: rikyu, azure, fastapi, sqlalchemy, service-bus, openai, backend

## what_happened
5/1 MVP の Azure 構築完了後、API/Worker のコード実装を進めた。FastAPI + SQLAlchemy 2.x async + asyncpg、RLS は session 変数 SET、認証は mock JWT (HS256)、Service Bus 連携、Azure OpenAI ラッパー (Foundry endpoint 対応) を実装。

## countermeasure
API: 17 endpoint (companies/agendas/key-persons/meetings/jobs/proposals/ai-proposals)。Worker: 2 handler (agenda_update_from_meeting / proposal_story)。9 unit test 全 pass。デプロイ用 GitHub Actions (build & push only) + local az CLI deploy.sh + setup-acr-credentials.sh + issue-mock-jwt.py + seed-dev-data.py を整備。

## result
明日社長が ACR Admin / GitHub Secrets / setup-acr-credentials.sh を実行すれば deploy 可能な状態。コードは syntax/import/test 全て通過。

<!-- id: a643878f-8f0b-4194-9027-092d87750148 -->
