# tasks テーブルの type 分類ミス（task/request）

- **type**: `failure`
- **date**: 2026-04-06
- **category**: process / **severity**: medium
- **status**: active
- **source**: manual

## what_happened
アーキ改善の10タスクを全て type=task で登録。宮路さんが実施するもの以外は request にすべきだった

## root_cause
task/request の分類定義を確認せずに INSERT した。migration-040 で定義されていた

## countermeasure
knowledge_base にルールを蓄積済み。/company スキルのタスク登録時に type 判定を明示化

<!-- id: c72c1783-9444-4307-8f04-80425a34f3d5 -->
