# AIチャット履歴は無制限・人レベル分離

- **type**: `decision`
- **date**: 2026-04-25
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: focus-you, ui, auto-detected, daily-batch, llm-classified

## what_happened
focus-youのAIチャットでセッション分離可能にしつつ会話履歴は無制限保持。会話ログは精度改善・システム改善の重要データとして分析観点で残す。会話は人（ユーザー）レベルで分離。

## result
履歴保持方針確定

<!-- id: eef500d5-6696-4121-867e-6710a7723cd1 -->
