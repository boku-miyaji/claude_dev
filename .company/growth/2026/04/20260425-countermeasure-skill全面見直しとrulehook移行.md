# skill全面見直しとrule/hook移行

- **type**: `countermeasure`
- **date**: 2026-04-25
- **category**: tooling / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: claude-dev, agent-harness, auto-detected, daily-batch, llm-classified

## what_happened
未使用skillの無効化を実施。design/zennは残し、diary/weekly-digest/pptx系は削除。skillにカウント計測の一文を必ず入れる運用ルールを追加し、rule/hookに移すべきものを移管した。

## root_cause
skillが多すぎて実際に使われているか把握できず、エージェントの判断材料も不明確だった

## countermeasure
skill毎に用途と利用ログ仕込みを必須化、不要skill削除、rule/hookとの役割分離を明確化

<!-- id: fb11c59e-3eb5-41ac-acc7-b6156e760a12 -->
