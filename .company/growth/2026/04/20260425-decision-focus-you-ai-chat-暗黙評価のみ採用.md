# focus-you AI Chat: 暗黙評価のみ採用

- **type**: `decision`
- **date**: 2026-04-25
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: focus-you, ui, llm-prompt, auto-detected, daily-batch, llm-classified

## what_happened
AIチャットの評価方式を決定。グッドバッドボタンは廃止し、明示的評価は要求しない。質問内容・行動・面談情報からの暗黙的評価で「役立っているか」を判定する方針。

## result
明示評価UIを削除し、暗黙シグナル（質問質・滞在・業務連動）で評価する設計に決定

<!-- id: b04acfbe-e96b-480b-ae2f-cd53431405b2 -->
