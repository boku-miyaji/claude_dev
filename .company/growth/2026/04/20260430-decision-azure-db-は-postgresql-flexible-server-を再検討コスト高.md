# Azure DB は PostgreSQL Flexible Server を再検討（コスト高）

- **type**: `decision`
- **date**: 2026-04-30
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: rikyu, azure, postgres, cost, auto-detected, daily-batch, llm-classified

## what_happened
Azure 上の DB として PostgreSQL Flexible Server (v18, P4) で見積もったが約 $80/月で高い。Microsoft 製の代替（Cosmos DB 等 NoSQL）を検討するも検索性に懸念。pgvector 用途も含めワークロード種別（運用 / dev-test）と性能ティアの再判断が必要。

## countermeasure
コスト/検索性/pgvector 対応を軸に DB 選定を再評価。dev-test ティアやより低コストな構成を比較検討する方針

<!-- id: de04221f-4259-4c32-b8bb-24993ad4f93f -->
