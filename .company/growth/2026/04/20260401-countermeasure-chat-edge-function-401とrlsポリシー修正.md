# Chat Edge Function 401とRLSポリシー修正

- **type**: `countermeasure`
- **date**: 2026-04-01
- **category**: security / **severity**: medium
- **status**: active
- **source**: backfill
- **tags**: security, auth, rls, claude-dev
- **commits**: 75c3665, 769df04, 0a5cb49

## what_happened
AI ChatでEdge Function 401エラーが発生、またcomments/tasksテーブルのingest-key RLSが未整備だった。リクエスト前のJWTリフレッシュとRLSポリシー追加で解決。

## root_cause
JWT期限切れを考慮していない実装とRLSポリシー不足

## countermeasure
リクエスト前JWTリフレッシュ処理追加、ingest-key RLSポリシーを補完、chat security hardening P0-P2を実装

## result
認証エラー解消、セキュリティ基準を満たす状態に

<!-- id: 1652b0fb-3e87-4745-9469-46b3d3f140a7 -->
