# Supabase Edge Function 認証は verify_jwt=false + 関数内 getUser() を標準化

- **type**: `countermeasure`
- **date**: 2026-04-22
- **category**: security / **severity**: high
- **status**: active
- **source**: manual
- **tags**: claude-dev, supabase, edge-function, auth, manual-record

## what_happened
新規 user 認証を要する Edge Function はデフォルトで supabase/config.toml に [functions.{name}] verify_jwt = false を書き、関数内で sb.auth.getUser(jwt) を使って Supabase 自身に検証させる方式を標準化

## root_cause
Supabase が 2025末〜2026初頭に ES256 非対称鍵 + sb_publishable_* publishable key 方式に移行し、ゲートウェイ組み込み verify_jwt が ES256 署名の user JWT を拒否して {code:401, Invalid JWT} を返す事象が発生した

## countermeasure
verify_jwt=false に設定し、関数内で /auth/v1/user を叩いて Supabase 自身に検証させる。署名アルゴリズムに依存しないため ES256 移行後も動作する

## result
google-calendar-proxy / ai-agent で正常稼働。以後の新規 Edge Function はこの方式をデフォルトとする

<!-- id: 55465226-88f7-4a26-961b-50f803aa0469 -->
