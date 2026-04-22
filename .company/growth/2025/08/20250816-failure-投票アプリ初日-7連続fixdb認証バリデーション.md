# 投票アプリ初日 — 7連続fix（DB/認証/バリデーション）

- **type**: `failure`
- **date**: 2025-08-16
- **category**: tooling / **severity**: medium
- **status**: resolved
- **source**: manual
- **tags**: tooling, rapid-dev, validation, database
- **commits**: ba06193, 43a5e30, fb1331e, 8effc27, 0aa9b21, a27a5b6, 320c0c1

## what_happened
投票アプリを1日で作ろうとしたが、SQLiteのDB設定、npm依存関係、ポート衝突、セッションバリデーション（UUID vs CUID）、投票率制限、ステータス値の大文字小文字、投票方式の固定化、と7つの連続fixが発生。

## root_cause
「1日で完成させる」プレッシャーで、設計を飛ばして実装に入った。各コンポーネントの仕様（Prismaのデフォルト型、Supabaseのバリデーション等）を確認せずに進めた。

## countermeasure
各fixを順に適用して最終的に動作する状態に。投票方式を3-2-1に固定してUIもシンプル化。

## result
急いで作るほどfixが増える。「設計30分→実装2時間」の方が「実装3時間→fix3時間」より速い。

<!-- id: 6039cc17-2e0b-4d7b-a06a-b99be71f4254 -->
