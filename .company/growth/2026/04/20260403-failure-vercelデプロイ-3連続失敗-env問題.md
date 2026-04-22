# Vercelデプロイ 3連続失敗 — .env問題

- **type**: `failure`
- **date**: 2026-04-03
- **category**: devops / **severity**: medium
- **status**: resolved
- **source**: manual
- **tags**: devops, vercel, env, deployment
- **commits**: cf1a079, 5f47c5b, 1523a55

## what_happened
React移行後のVercelデプロイが3回連続で失敗。build設定不足→.envをgitにコミット→.envをgitから除外して.env.example追加、とデプロイ設定が二転三転。

## root_cause
Vercelの環境変数管理（ダッシュボードで設定 vs .envファイル vs vercel.json）の正しいパターンを把握していなかった。

## countermeasure
Vercelダッシュボードで環境変数を設定、.envは.gitignoreに追加、.env.exampleをテンプレートとして提供。

## result
環境変数は「どこで管理するか」を最初に決める。.envのgitコミットは絶対に避ける（一度コミットすると履歴に残る）。

<!-- id: 4ce84374-1e1d-4ee6-ba46-6d2114ddf446 -->
