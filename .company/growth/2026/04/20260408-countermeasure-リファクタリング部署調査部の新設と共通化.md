# リファクタリング部署/調査部の新設と共通化

- **type**: `countermeasure`
- **date**: 2026-04-08
- **category**: architecture / **severity**: high
- **status**: active
- **source**: backfill
- **tags**: refactoring, organization, shared-module, claude-dev
- **commits**: e9bf31f, b403847, deee582, 05b4fc2

## what_happened
同じ機能がページ単位で別実装されていることを社長が指摘。newsCollectの3重実装を共通モジュール化し、保守運用を担うリファクタリング部署と内部調査を担う調査部を新設した。

## root_cause
ページ単位で機能を管理する文化により、共通ロジックの重複実装が蓄積していた

## countermeasure
newsCollect.ts を共有モジュール化、リファクタリング部署・調査部を登録、registry/pipeline ルールを同期

## result
共通化と組織的な保守体制が確立

<!-- id: 26bc0b97-14e8-4fef-ba7f-dad9631af5ee -->
