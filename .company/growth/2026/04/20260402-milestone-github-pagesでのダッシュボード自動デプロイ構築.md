# GitHub Pagesでのダッシュボード自動デプロイ構築

- **type**: `milestone`
- **date**: 2026-04-02
- **category**: devops / **severity**: medium
- **status**: active
- **source**: backfill
- **tags**: ci, github-pages, cache, claude-dev
- **commits**: c6b26f6, 8cd4d16

## what_happened
company-dashboardのGitHub Pagesデプロイ用ワークフローを追加。併せてキャッシュ制御メタタグを入れ、古いファイルが配信される問題を予防した。

## root_cause
手動デプロイ運用で配信の鮮度管理が弱かった。

## countermeasure
deploy-dashboard.ymlでCI化し、index.htmlにcache-control metaを追加。

## result
ダッシュボードのデプロイが自動化され配信鮮度が安定。

<!-- id: 2c1e9dac-e844-489c-a39b-8b2ac0c96906 -->
