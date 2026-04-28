# rikyu: monorepo構成 + Container Apps採用

- **type**: `decision`
- **date**: 2026-04-28
- **category**: architecture / **severity**: high
- **status**: active
- **source**: detector
- **tags**: rikyu, azure, monorepo, auto-detected, daily-batch, llm-classified

## what_happened
rikyuのインフラ構成壁打ちで、frontend/backend独立性を上げつつフロントエンドは共通化する方針を確認。Azure前提でmonorepo採用、FastAPI(Python)でバックエンド、Container Appsで動かす方向に決定。Static Web AppsはNext.js制約で見送り、APIMはdeveloperから開始。

## result
monorepoでいく方針確定。FastAPIで本番運用、Container Apps採用。APIMはdeveloperから段階導入。

<!-- id: 8f2e6e44-0531-4718-a822-894a9bf67d15 -->
