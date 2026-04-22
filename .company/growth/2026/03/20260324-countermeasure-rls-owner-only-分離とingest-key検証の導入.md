# RLS owner-only 分離とingest-key検証の導入

- **type**: `countermeasure`
- **date**: 2026-03-24
- **category**: security / **severity**: high
- **status**: active
- **source**: backfill
- **tags**: RLS, supabase, secrets, auth
- **commits**: 2698445, d6581b0, 9eafc54, 986b4ec, cfaede8

## what_happened
anon_all ポリシーが残っていたため全ユーザーがデータ横断参照できる状態だった。owner-only RLSへ切り替え、初回ログイン時の自動登録、ingest-keyヘッダ検証、ハードコードされたシークレット除去を一括で実施。

## root_cause
初期セットアップ時のゆるい RLS ポリシーと、Hook からの書き込み用シークレットがコードに直書きされていた

## countermeasure
migration 015〜018 で anon_all を全削除し owner-only に。user_settings テーブル + Settings GUI で ingest key 管理、supabase.env に集約

## result
ダッシュボードのデータ分離が確立、Hook からの ingest も鍵ベースで認可されるようになった

<!-- id: eb43c744-5cc6-4bcc-bf02-266e7de60ad4 -->
