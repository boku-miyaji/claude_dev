# staleコンテンツ配信 — デプロイしても古いファイルが表示

- **type**: `failure`
- **date**: 2026-04-02
- **category**: devops / **severity**: low
- **status**: resolved
- **source**: manual
- **tags**: devops, cache, vercel, cdn, deployment, claude-dev
- **commits**: 8cd4d16

## what_happened
Vercelにデプロイしても、ブラウザが古いHTML/JSをキャッシュして新機能が反映されない問題が発生。

## root_cause
VercelのCDNキャッシュ＋ブラウザキャッシュの二重キャッシュで、デプロイ後もstaleファイルが配信されていた。

## countermeasure
HTMLにcache-control meta tagを追加し、キャッシュを制御。

## result
SPAのデプロイ後は「ユーザーに新しいファイルが届くか」まで確認する。CDN＋ブラウザの二重キャッシュ問題は見落としやすい。

<!-- id: 15c84bda-387a-434a-a171-96887c09edea -->
