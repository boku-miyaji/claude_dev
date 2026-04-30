# Azure PostgreSQL Flexible Server 構成見直し

- **type**: `decision`
- **date**: 2026-04-30
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: rikyu, azure, postgresql, cost, auto-detected, daily-batch, llm-classified

## what_happened
rikyu インフラ設計で Azure PostgreSQL Flexible Server (PG18, P4, $80/月) の構成見直し議論。価格が高すぎる懸念、Microsoft 製代替（Cosmos DB等NoSQL）も検討。なぜ Flexible Server を選んだかの経緯も再確認。RG/tenant 分割方針も論点に。

## countermeasure
代替案として Microsoft 製 NoSQL を検討、検索性のトレードオフを評価。RG/tenant 分割ガイドラインを整理

<!-- id: 100dff94-6959-4f03-9233-0b97f323f47f -->
