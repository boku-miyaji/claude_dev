# AIチャット評価は暗黙的シグナルで行う

- **type**: `decision`
- **date**: 2026-04-25
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: focus-you, ui, llm-prompt, auto-detected, daily-batch, llm-classified

## what_happened
focus-you AIチャットの評価方式について、グッドバッドボタンや明示的評価は使わず、質問内容・行動・面談情報・滞在時間など暗黙的シグナルから満足度を判定する方針を決定。会話履歴は無制限保存・人レベルで分離する。

## result
明示的評価UIを排除し、行動ログ分析でシステム改善する設計に統一

<!-- id: c8d0ff55-b384-4953-8158-7e690d2a9e6f -->
