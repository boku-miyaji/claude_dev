# 部署の中央集約化 — 子会社ごとの部署をHDに統合

- **type**: `countermeasure`
- **date**: 2026-03-23
- **category**: organization / **severity**: high
- **status**: resolved
- **source**: manual
- **tags**: organization, architecture, dry, centralization
- **commits**: f72958d, 3f97d7a

## what_happened
各PJ会社（foundry, rikyu, circuit）にそれぞれ ai-dev, sys-dev, research 等の部署を作っていたが、部署のルール更新が各社に分散し、同じ改善を3回やる羽目に。

## root_cause
「各PJ会社が独立した組織」という設計が、小規模運用では過剰だった。部署のルールは共通なのに、各社に別々のCLAUDE.mdを持たせていた。

## countermeasure
共通部署をHD（.company/departments/）に集約。子会社はPJ固有コンテキスト（クライアント情報、リポジトリ）のみ保持する設計に変更。

## result
組織設計も「共通ロジックの集約」が重要。DRY原則は人間の組織にも適用できる。

<!-- id: cd2d73e7-af1d-4b8a-b5ca-747590f239ce -->
