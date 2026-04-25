# Skills 全面見直し・rules/hooks 移管

- **type**: `countermeasure`
- **date**: 2026-04-25
- **category**: organization / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: claude-dev, automation, tooling, auto-detected, daily-batch, llm-classified

## what_happened
HD運用で蓄積された skill を全面見直し、未使用は無効化。1,2,3, pptx系, diary, weekly-digest, auto-prep を削除し design/zenn を残す方針。skill が使われた回数を数えられるよう各 SKILL.md に運用文言を必ず入れる仕組みも追加。

## root_cause
skill が増えすぎて稼働率が見えず、rule/hook で済むものまで skill 化されていた

## countermeasure
稼働率を計測可能な形に SKILL テンプレ化、rule/hook で代替できるものは移管、未使用は削除

<!-- id: 16745a71-ec37-4a79-8650-a878afa9d8c8 -->
