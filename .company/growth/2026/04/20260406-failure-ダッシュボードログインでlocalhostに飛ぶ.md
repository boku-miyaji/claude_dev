# ダッシュボードログインでlocalhostに飛ぶ

- **type**: `failure`
- **date**: 2026-04-06
- **category**: devops / **severity**: high
- **status**: active
- **source**: llm-retroactive
- **tags**: focus-you, auth, frontend, llm-retroactive, llm-classified

## what_happened
claude-devダッシュボード(focus-you)にログインするとlocalhostにリダイレクトされる障害が発生。Vercel設定起因と推測され本番のログインフローが動作していない状態。

## root_cause
Vercel or Supabase Auth の redirect URL 設定が本番URLではなくlocalhostを指している可能性

<!-- id: 66eace05-e8b1-44da-8246-bfe40a136439 -->
