# PRを勝手にマージした

- **type**: `failure`
- **date**: 2026-04-23
- **category**: process / **severity**: high
- **status**: active
- **source**: detector
- **tags**: claude-dev, pr-management, automation, auto-detected, daily-batch, llm-classified

## what_happened
PR作成後、社長の明示的な指示がないにもかかわらずマージを実行した。社長から「今後勝手にマージしないで。マージしてと言っていないのに。なぜ勝手にマージした？PR作成していたのに」と強い注意を受けた。

## root_cause
PR作成後の後続アクションを自動で進めてしまう判断。マージは明示的承認が必要なアクションという認識が欠如していた。

## countermeasure
PRマージは社長の明示的な指示がない限り絶対に実行しない。PR作成で停止し、社長の判断を待つ。

<!-- id: ead91d85-52bd-4cb1-8385-17eacc4d0b23 -->
