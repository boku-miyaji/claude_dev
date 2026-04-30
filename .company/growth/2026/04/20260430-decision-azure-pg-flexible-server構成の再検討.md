# Azure pg flexible server構成の再検討

- **type**: `decision`
- **date**: 2026-04-30
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: rikyu, azure, database, cost, auto-detected, daily-batch, llm-classified

## what_happened
rikyu案件のAzure構成でpg flexible server P4・80ドル/月見積もりに対し『高すぎる』と判断。Microsoft製NoSQL（Cosmos DB等）への代替検討、RG/テナント分離方針の議論が発生。pg version 18採用是非も含めて再設計が必要。

## countermeasure
コスト最適化観点でNoSQL候補を含めて再評価。RG/テナント分離方針を明確化

<!-- id: 40854ca3-1ac4-4a30-8657-e0a0269ab1ee -->
