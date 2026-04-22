# localhost起動時にVercel本番URLへ強制リダイレクト

- **type**: `failure`
- **date**: 2026-04-03
- **category**: devops / **severity**: high
- **status**: active
- **source**: llm-retroactive
- **tags**: focus-you, frontend, auth, llm-retroactive, llm-classified

## what_happened
ローカルで動作確認したいのに localhost がいきなり claude-dev-virid.vercel.app/# に遷移してしまい、local環境での検証が不可能。開発体験を阻害する深刻なルーティングバグ。

## root_cause
認証リダイレクトまたはVercel設定のハードコードURLがlocalhost環境を考慮していない

<!-- id: d6a0c6e4-cded-4f04-a31d-37ca9cece7ce -->
