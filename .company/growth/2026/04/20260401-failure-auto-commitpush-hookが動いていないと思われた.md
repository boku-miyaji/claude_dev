# auto-commit/push hookが動いていないと思われた

- **type**: `failure`
- **date**: 2026-04-01
- **category**: automation / **severity**: medium
- **status**: resolved
- **source**: manual
- **tags**: hook, auto-save

## what_happened
commit+pushして→hookで自動化されているはずなのに手動確認を求められた

## root_cause
hookの動作が不透明。実行結果の可視性がない

## countermeasure
auto-save hookの存在と動作を理解。フィードバック記録

## result
hookが自動処理していることを確認

<!-- id: 636b68e6-a830-468d-8a6f-bc88e020e64c -->
