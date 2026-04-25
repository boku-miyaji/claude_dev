# skill/rule/hook の責務再整理と無効化

- **type**: `decision`
- **date**: 2026-04-25
- **category**: tooling / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: claude-dev, automation, auto-detected, daily-batch, llm-classified

## what_happened
使っていないスキルの無効化と、skill/rule/hook の使い分けを再検討。skillは明示呼び出し中心で、自動適用すべきものはrule/hookに移行。スキル使用回数のカウント機能も検討（skillに必須一文を入れる運用案）。

## root_cause
skill が自動的にエージェントに使われない、運用効果が見えない

## countermeasure
未使用スキルを削除（pptx系、diary、weekly-digest、auto-prep等）、design/zennは残す

## result
スキル一覧をスリム化、運用が回る仕組みを設計中

<!-- id: 66244fd0-a5ec-4139-ba18-d6fe02255214 -->
