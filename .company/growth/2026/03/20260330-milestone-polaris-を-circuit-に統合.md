# polaris を circuit に統合

- **type**: `milestone`
- **date**: 2026-03-30
- **category**: organization / **severity**: medium
- **status**: active
- **source**: backfill
- **tags**: refactor, organization, company
- **commits**: 41a9ffa

## what_happened
polaris と circuit は同じ会社として扱う方針に基づき、.company-polaris を circuit 側にマージして削除。仮想組織の重複を解消した。

## root_cause
当初別PJ会社として分けていたが実態は同一だった

## countermeasure
.company-polaris を削除し circuit に統合

## result
組織構造がシンプル化

<!-- id: 438944a0-e0d9-427a-b82b-b82bfae676c3 -->
