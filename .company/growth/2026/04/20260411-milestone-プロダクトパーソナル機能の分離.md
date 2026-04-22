# プロダクト/パーソナル機能の分離

- **type**: `milestone`
- **date**: 2026-04-11
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: backfill
- **tags**: product-separation, navigation, commercialization, claude-dev
- **commits**: 245c557, 5e13644, 00897e3

## what_happened
サイドバーとモバイルナビをプロダクト用途と CLI（パーソナル）用途で分離。分離マップドキュメントも整備し、商用化に向けた境界を明示した。

## root_cause
個人用機能とプロダクト機能が混在し商用化の境界が曖昧だった

## countermeasure
UI ナビを分離し機能マップを文書化

<!-- id: 8c443b70-15d0-453f-b4a5-c6942375f97e -->
