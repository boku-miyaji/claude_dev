# AIチャット履歴は無制限保持・人レベル分離

- **type**: `decision`
- **date**: 2026-04-25
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: focus-you, llm-prompt, analytics, auto-detected, daily-batch, llm-classified

## what_happened
AIチャットの会話ログ運用方針を決定。会話履歴は無制限に保持、セッションは分けて表示、会話は人レベルで分離。明示的なグッドバッドボタンは廃止し、行動・面談情報・質問内容から暗黙的に満足度を評価する。

## result
ログは精度改善・システム改善の重要分析素材として残す方針

<!-- id: d439314a-6f97-452c-b1e2-c0a0da56731f -->
