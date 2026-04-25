# skill→rule/hook変換 + スキル10個削除

- **type**: `decision`
- **date**: 2026-04-24
- **category**: tooling / **severity**: medium
- **status**: active
- **source**: daily-digest
- **tags**: agent-harness, tooling, operations, auto-detected, daily-digest
- **commits**: ff50d44, 1243f85, 557f607

## what_happened
スキル乱立を整理し、registerをスキルから自動実行ruleに変換、supabase-preflightをルール化。さらに使用頻度の低いスキル10個を一括削除してusage trackingを修正、auto-prepも廃止。

## root_cause
スキルが増えすぎてセッション中の判断負荷が増大し、未使用スキルが多数滞留していたため

## countermeasure
頻繁に使うものはhookで自動化、ルール参照に置き換え、未使用は削除という判断基準を確立

## result
スキルセットがスリム化し、自動実行化されたものは選択判断が不要に

<!-- id: 3f0d7b8f-5ef7-4d60-994e-9c563568c77c -->
