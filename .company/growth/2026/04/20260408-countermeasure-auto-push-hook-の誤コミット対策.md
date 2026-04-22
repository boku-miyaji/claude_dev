# auto-push hook の誤コミット対策

- **type**: `countermeasure`
- **date**: 2026-04-08
- **category**: security / **severity**: critical
- **status**: active
- **source**: backfill
- **tags**: auto-push, secrets, hook-safety
- **commits**: e416c0b, 4bdb1b7

## what_happened
auto-push hook が意図しないシークレットを巻き込む可能性があった件に対し、safety guard を追加。直近に明示コミットがある場合はスキップするロジックも導入した。

## root_cause
auto-save 挙動が明示コミットと競合し、秘匿ファイルを巻き込むリスクがあった

## countermeasure
auto-push.sh に secret guard と explicit-commit スキップを実装、インシデントレポート作成

## result
auto-save の安全性が向上

<!-- id: ab12ebe9-207d-468a-82d1-85ac60163e1c -->
