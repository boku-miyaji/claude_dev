# AIチャット履歴は人単位・無制限・暗黙評価

- **type**: `decision`
- **date**: 2026-04-25
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: focus-you, ui, llm-prompt, auto-detected, daily-batch, llm-classified

## what_happened
focus-youのAIチャット設計でセッション分離・人レベル分離・履歴無制限保持を決定。グッドバッドボタンは廃止し、質問内容や行動・面談情報から暗黙的に満足度を評価する方針。

## result
明示評価UIなし、暗黙評価ベースの分析方針確定

<!-- id: 406dfc65-ab13-4bc2-bd34-21eeeaf99c9b -->
