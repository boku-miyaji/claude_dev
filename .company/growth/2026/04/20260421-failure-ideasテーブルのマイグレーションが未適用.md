# ideasテーブルのマイグレーションが未適用

- **type**: `failure`
- **date**: 2026-04-21
- **category**: devops / **severity**: medium
- **status**: active
- **source**: llm-retroactive
- **tags**: focus-you, supabase, migration, llm-retroactive, llm-classified

## what_happened
supabase-migration-065-ideas.sqlを確認したが、ideasテーブル/データが存在しておらず機能が成立していないことが判明

## root_cause
マイグレーションファイルは存在するが、本番DBに適用されていない可能性

## result
原因調査が必要

<!-- id: ae24908e-fc57-4d9e-b901-3d0972fbf811 -->
