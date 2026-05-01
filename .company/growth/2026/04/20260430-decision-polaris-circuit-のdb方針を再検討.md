# polaris-circuit のDB方針を再検討

- **type**: `decision`
- **date**: 2026-04-30
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: daily-digest
- **tags**: polaris-circuit, architecture, backend, auto-detected, daily-digest

## what_happened
polaris-circuit の永続化レイヤとして Azure PostgreSQL Flexible Server を本命としていたが、コスト懸念から Microsoft 製 NoSQL（Cosmos DB 等）への転換を検討。最終的に Flexible Server 構成を見直して再検討する方向に着地した。

## root_cause
Flexible Server のランニングコストが想定より高く、回路部品メタデータの検索特性に対し過剰な可能性が出てきた

## countermeasure
Cosmos DB 系の検索性・コストを再評価し、pgvector 用途と分離する案を含めて再設計

## result
DB選定が再オープン状態。次回までに比較表を作る予定

<!-- id: 88e2aabc-0754-4fee-bdbb-bde63c932ae4 -->
