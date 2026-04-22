# Today画面を3ブロック構成に再設計

- **type**: `milestone`
- **date**: 2026-04-15
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: daily-digest
- **tags**: today, ux, refactor
- **commits**: fb01d88, 128391f

## what_happened
Today画面から「今日やること」を削除し、「今日の予定」に統合。3ブロック構成へリファクタリングしBlueprintにも反映した。

## root_cause
タスクと予定の二重管理がUX上の混乱を生んでいた

## countermeasure
予定側に統合し、単一のタイムライン表現に集約

## result
Today画面の情報構造がシンプル化

<!-- id: 22ddd681-e219-451d-b3ed-2595ac52323c -->
