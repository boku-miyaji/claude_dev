# rikyu: Azure AI Search + PostgreSQL採用

- **type**: `decision`
- **date**: 2026-04-28
- **category**: architecture / **severity**: high
- **status**: active
- **source**: detector
- **tags**: rikyu, azure, postgresql, auto-detected, daily-batch, llm-classified

## what_happened
rikyuのデータ基盤で、Azure AI Searchを立てた上でDBはPostgreSQL(Azure)を採用する方向で壁打ち。Azure SQLとの差分は純正度のみで運用性的にPostgreSQLに優位ありと判断、簡易検索もカバー可能な構成に決定（B2案）。

## result
B2案（Azure AI Search + Azure Database for PostgreSQL）で決定。

<!-- id: 2cc701d3-b3e4-41a4-96d7-8b2240f5e2b4 -->
