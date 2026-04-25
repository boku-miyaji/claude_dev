# focus-you AI Chat 履歴設計

- **type**: `decision`
- **date**: 2026-04-25
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: focus-you, ui, auto-detected, daily-batch, llm-classified

## what_happened
AIチャットの会話履歴は人レベルで分離し、無制限保存。新規セッション/過去セッションの区別を可視化。会話ログは精度改善・システム改善のための重要分析データとして残す。

## result
人単位・無制限・セッション分割可能・分析利用前提の設計に決定

<!-- id: 2a19bed5-6e23-443a-b9a4-cbe33b9aa9fd -->
