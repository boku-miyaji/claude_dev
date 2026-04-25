# AIチャット評価は暗黙的のみ（GB廃止）

- **type**: `decision`
- **date**: 2026-04-25
- **category**: process / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: focus-you, ui, llm-prompt, auto-detected, daily-batch, llm-classified

## what_happened
focus-youのAIチャット品質評価について、グッドバッドボタンによる明示的評価を廃止。質問内容・行動・面談情報から暗黙的に満足度を測る方針に転換。明示評価は「絶対してくれない」ため。

## result
暗黙評価ベースのログ・分析設計へ

<!-- id: dece22f3-c53a-4168-ac9b-b480b7801e3e -->
