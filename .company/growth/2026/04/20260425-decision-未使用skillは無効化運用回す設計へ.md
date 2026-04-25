# 未使用skillは無効化・運用回す設計へ

- **type**: `decision`
- **date**: 2026-04-25
- **category**: tooling / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: claude-dev, automation, auto-detected, daily-batch, llm-classified

## what_happened
HD運用中のスキルを全面見直し。pptx系・diary・weekly-digest・auto-prepなど未使用skillを削除。skillが使われたら計測・カウントできる仕組みをskill自体に組み込み、運用が自然に回る設計に転換。

## root_cause
skill利用状況が見えず使われないskillが蓄積

## countermeasure
skill内に利用記録の一文を必ず入れる

<!-- id: d862d58d-2e02-4f77-880d-824fb775729e -->
