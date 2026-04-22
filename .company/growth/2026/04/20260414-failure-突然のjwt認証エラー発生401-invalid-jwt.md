# 突然のJWT認証エラー発生(401 Invalid JWT)

- **type**: `failure`
- **date**: 2026-04-14
- **category**: security / **severity**: high
- **status**: active
- **source**: llm-retroactive
- **tags**: claude-dev, edge-function, auth, supabase, llm-retroactive, llm-classified

## what_happened
Calendar.tsx を開いている最中に突然『認証エラー: {"code":401,"message":"Invalid JWT"}』が発生。Supabaseゲートウェイによる拒否で、ES256非対称鍵問題の再発と考えられる。

## root_cause
ES256非対称鍵方式への移行に伴うゲートウェイ組み込みverify_jwtの不整合

<!-- id: e0afe3db-79b7-4628-93ce-266969118731 -->
