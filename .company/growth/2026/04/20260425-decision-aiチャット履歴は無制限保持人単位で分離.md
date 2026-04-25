# AIチャット履歴は無制限保持・人単位で分離

- **type**: `decision`
- **date**: 2026-04-25
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: focus-you, supabase, auto-detected, daily-batch, llm-classified

## what_happened
AIチャットのログは精度改善・システム改善に活用する重要データと位置付け、無制限保持・人レベル分離・セッションを分けて新旧識別可能にする方針を決定。

## result
分析活用を前提としたログ設計方針が確立

<!-- id: 4b7b6ba5-1119-4ae5-8dd1-ff794432795e -->
