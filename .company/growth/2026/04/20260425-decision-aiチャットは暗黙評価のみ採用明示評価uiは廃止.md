# AIチャットは暗黙評価のみ採用、明示評価UIは廃止

- **type**: `decision`
- **date**: 2026-04-25
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: focus-you, ui, llm-prompt, auto-detected, daily-batch, llm-classified

## what_happened
AIチャットへのGood/Badボタンはユーザーが押さないため不要と判断。代わりに質問内容・行動・面談情報など暗黙的シグナルから満足度を分析する方針を決定。

## root_cause
明示評価UIはユーザー行動として現実的でない

## countermeasure
暗黙評価（質問パターン・滞在画面・業務連動）で精度改善のシグナルを収集する設計へ

<!-- id: b20191bb-7c23-4ce2-b4e6-4e47fad01686 -->
