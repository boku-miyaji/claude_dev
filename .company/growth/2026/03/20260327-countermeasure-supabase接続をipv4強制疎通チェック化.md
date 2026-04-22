# Supabase接続をIPv4強制＋疎通チェック化

- **type**: `countermeasure`
- **date**: 2026-03-27
- **category**: devops / **severity**: medium
- **status**: active
- **source**: backfill
- **tags**: supabase, network, hooks
- **commits**: 8e92057

## what_happened
Supabase 接続が不安定な環境向けに curl を IPv4 強制し、supabase-check / supabase-status hook で疎通確認を追加した。

## root_cause
IPv6 経路でのタイムアウトや接続失敗が hook の無言失敗を誘発していた

## countermeasure
hook スクリプトを --ipv4 付きに修正し、疎通チェック専用 hook を追加

## result
Supabase 系 hook の失敗モードが可視化された

<!-- id: 20b526eb-c1e3-4cec-a73a-b86c8ca0c01b -->
