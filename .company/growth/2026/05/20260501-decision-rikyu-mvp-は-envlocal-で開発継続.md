# rikyu MVP は .env.local で開発継続

- **type**: `decision`
- **date**: 2026-05-01
- **category**: devops / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: rikyu, azure, devcontainer, auto-detected, daily-batch, llm-classified

## what_happened
Azure CLI のインストールやポータル経由デプロイが現環境で困難なため、ACES 配布PCではない開発機で .env.local（DATABASE_URL, MOCK_JWT_SECRET, API secret）を使った開発を継続する方針を採用。

## result
ローカル開発を止めずに進められる。デプロイ系タスクは別途 SESSION_2026-05-01_DEPLOY.md で手順化。

<!-- id: 72a1575c-36db-4128-933e-8b31c35f12ef -->
