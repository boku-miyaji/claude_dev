# user_id + RLS によるユーザー単位のデータ分離

- **type**: `countermeasure`
- **date**: 2026-03-19
- **category**: security / **severity**: high
- **status**: active
- **source**: backfill
- **tags**: rls, security, multi-tenant, supabase, claude-dev
- **commits**: 6336036, dd84012, 45cbdc4

## what_happened
ダッシュボードのSupabaseテーブルに user_id カラムとRLSポリシーを追加し、fork-basedのper-userセキュリティモデルへ移行。READMEもセキュリティモデル前提で刷新した。

## root_cause
複数ユーザーが同じプロジェクトを利用する際にデータが混在する懸念があった

## countermeasure
migration-001でuser_id追加+RLS有効化、fork運用を前提としたドキュメント整備

## result
ユーザー単位のデータ分離が確立

<!-- id: 6236b4f9-7542-48eb-8fba-468778117c9a -->
