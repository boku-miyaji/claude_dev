# skill大量整理と利用カウント導入

- **type**: `decision`
- **date**: 2026-04-25
- **category**: organization / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: claude-dev, agent-harness, auto-detected, daily-batch, llm-classified

## what_happened
HD運用skillを全面見直し。pptx系・diary・weekly-digest・auto-prep等を削除、design・zennは残す決定。また、skillが使われたか計測できるよう、各skill内に利用報告の一文を必ず含める運用フローを定義。Claudeが暗黙的にskillを使う仕組みも整理。

## root_cause
skill利用が見えず、使われていないものが放置されていた

<!-- id: cb034e2c-f7c2-4402-8eb8-ab5d3800566e -->
