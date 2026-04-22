# GitHub Actionsでintelligence収集パイプライン構築

- **type**: `milestone`
- **date**: 2026-03-23
- **category**: automation / **severity**: high
- **status**: active
- **source**: backfill
- **tags**: github-actions, intelligence, dashboard, supabase
- **commits**: 7104dcf, 21e6321, f8c3d98

## what_happened
intelligence-collect.ymlを新設し、定期的に情報収集レポートを生成→Supabase連携→ダッシュボードのIntelligenceページで閲覧できる一連のパイプラインを構築。夜間収集は21:00 JSTに調整。

## root_cause
情報収集を手動ではなく定期バッチで継続的に回す必要があった

## countermeasure
Actionsワークフロー+収集スクリプト+ダッシュボードUIを一括整備

## result
収集〜閲覧まで自動化。2026-03-23-1817の初回レポートが生成

<!-- id: d50a25da-dd34-4c92-9f2a-13fabfd2a925 -->
