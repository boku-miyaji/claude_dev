# .company/ 状態を Supabase に移行しマルチサーバ対応

- **type**: `milestone`
- **date**: 2026-03-20
- **category**: architecture / **severity**: high
- **status**: active
- **source**: backfill
- **tags**: supabase, multi-server, plugin-cache
- **commits**: 010b20f, c21d072, cc2f9d8, ae238e1

## what_happened
.company/ のローカル状態管理を Supabase に移行し、hostname:dir スコープによるマルチサーバ同期を実現。プラグインキャッシュのセッション開始時自動同期も追加した。

## root_cause
複数サーバ間で組織状態が同期されず、環境ごとに設定がばらつく課題があった

## countermeasure
Supabaseを単一ソースとし、SessionStart hookでキャッシュを自動生成・同期

## result
新サーバでも初回セッションから同じ組織状態で作業可能に

<!-- id: dd3b1645-42d4-47be-9372-d422b8df72c4 -->
