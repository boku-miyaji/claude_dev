# rikyu インフラを Azure monorepo 構成で進める

- **type**: `decision`
- **date**: 2026-04-28
- **category**: architecture / **severity**: high
- **status**: active
- **source**: detector
- **tags**: rikyu, azure, monorepo, fastapi, auto-detected, daily-batch, llm-classified

## what_happened
rikyu PJ のインフラ方針を壁打ち。FE/BE を分離しつつ FE は共通化重視・BE は個別具体化、Azure 前提で monorepo 採用、API は FastAPI（Python）で本番耐性を確認、FE は Static Web Apps ではなく Container Apps 系に寄せる方針、Azure AI Search を立てた上で DB は Postgres 寄りで検討、APIM は developer SKU から開始、という骨子で意思決定。

## countermeasure
monorepo + FastAPI(Python) + Azure Container Apps + Azure AI Search + Postgres + APIM(developer) の構成案 B2 を採用

## result
後続で E(messaging/Service Bus) など未確定項目の壁打ちを継続

<!-- id: d6e895ec-6945-4f5a-a171-f9b6869e85a3 -->
