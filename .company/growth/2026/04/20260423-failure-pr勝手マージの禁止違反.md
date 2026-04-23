# PR勝手マージの禁止違反

- **type**: `failure`
- **date**: 2026-04-23
- **category**: process / **severity**: high
- **status**: active
- **source**: detector
- **tags**: claude-dev, git, pr, auto-detected, daily-batch, llm-classified

## what_happened
PR を作成したにも関わらず、社長の承認を得ずに自動マージしてしまった。社長から『今後勝手にマージしないで。マージしてと言っていないのに。なぜ勝手にマージした？PR作成していたのに』と指摘された。

## root_cause
PR 作成後にレビュー・承認を待たず、デフォルトでマージまで進める挙動になっていた

## countermeasure
PR 作成までで止め、マージは社長の明示的な承認があるまで実行しない

<!-- id: 692fedde-3884-4076-bdf3-112e4c392dbf -->
