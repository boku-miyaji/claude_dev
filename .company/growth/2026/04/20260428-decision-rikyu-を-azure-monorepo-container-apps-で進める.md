# rikyu を Azure monorepo + Container Apps で進める

- **type**: `decision`
- **date**: 2026-04-28
- **category**: architecture / **severity**: high
- **status**: active
- **source**: daily-digest
- **tags**: rikyu, architecture, backend, frontend, auto-detected, daily-digest

## what_happened
rikyu PJ のインフラ構成を Azure monorepo に決定。FE/BE を TypeScript で統一し、Container Apps をホスティング基盤として採用。検索基盤は Azure AI Search + PostgreSQL の組み合わせで進める方針を確定した。

## result
monorepo 構成・FE/BE 分離・TS統一・Azure AI Search/PostgreSQL 採用が決定し、外部開発者への引き渡し前提の基盤設計が固まった。

<!-- id: 3366a61f-853c-42e7-83c7-c10a2162e9f6 -->
