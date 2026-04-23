# PR作成後に無断マージ

- **type**: `failure`
- **date**: 2026-04-23
- **category**: process / **severity**: high
- **status**: active
- **source**: detector
- **tags**: claude-dev, automation, auto-detected, daily-batch, llm-classified

## what_happened
PRを作成した後、社長から明示的な指示がないにも関わらず勝手にマージしてしまった。社長から強い指摘「今後勝手にマージしないで。マージしてと言っていないのに」があり、PR承認フローの信頼を損なった

## root_cause
PR作成で完了とせず、マージまでを一連の自動タスクとして実行した

## countermeasure
マージは必ず明示的指示を待つ。PR作成で停止し、社長の承認を得てからマージする

<!-- id: dadce5f1-921a-4d6f-92d4-b098147f8c0b -->
