# skill全面見直し：未使用skill削除・rule/hook化

- **type**: `countermeasure`
- **date**: 2026-04-25
- **category**: tooling / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: claude-dev, organization, auto-detected, daily-batch, llm-classified

## what_happened
skillの稼働状況を確認した結果、使われていないskillが多数存在。diary・weekly-digest・auto-prep・pptx系を削除、design・zennは残す方針。skillとして残すべきものとrule/hookに移すべきものを切り分け。skill使用を計測する仕組み（一文を必ず入れる等）も検討。

## root_cause
skillとrule/hookの使い分け基準が曖昧で、形骸化したskillが蓄積していた

## countermeasure
skill description明確化、未使用skill無効化、rule/hook化判定基準の整備

## result
skill運用が整理され稼働率の見える化へ

<!-- id: 233dc549-cccb-464f-8ea7-f24282f4b426 -->
