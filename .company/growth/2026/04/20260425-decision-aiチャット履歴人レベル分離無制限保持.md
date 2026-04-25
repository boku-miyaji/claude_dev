# AIチャット履歴：人レベル分離・無制限保持

- **type**: `decision`
- **date**: 2026-04-25
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: focus-you, supabase, auto-detected, daily-batch, llm-classified

## what_happened
AIチャットの会話履歴は無制限に保持し、人（ユーザー）レベルで分離。セッション単位で区切れるようにし、新規/過去セッションを識別可能にする。会話ログは精度改善・システム改善のための分析資産として位置づけ。

## result
ログ保持ポリシーを確定

<!-- id: cec9c99c-f310-4b2b-a099-cc10cdca0804 -->
