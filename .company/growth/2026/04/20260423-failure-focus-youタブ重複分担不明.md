# focus-youタブ重複・分担不明

- **type**: `failure`
- **date**: 2026-04-23
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: focus-you, ui, auto-detected, daily-batch, llm-classified

## what_happened
focus-you のタブが肥大化し、insights/self-analysis/manual 等で機能の重複や分担が不明確になった。growthがclaude code側の機能なのかも判断がつかない状態で、設計思想に基づく再整理が必要と判断された

## root_cause
タブ追加ごとに機能境界を再設計せず、似た役割のUIが並列で増殖した

<!-- id: d7aae37a-5c90-4b01-b67d-5d4d7f23337b -->
