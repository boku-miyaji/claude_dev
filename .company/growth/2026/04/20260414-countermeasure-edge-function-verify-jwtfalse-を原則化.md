# Edge Function verify_jwt=false を原則化

- **type**: `countermeasure`
- **date**: 2026-04-14
- **category**: devops / **severity**: high
- **status**: active
- **source**: daily-digest
- **tags**: supabase, edge-function, auth, rules, claude-dev
- **commits**: 3b1eefc

## what_happened
Supabase の ES256 非対称鍵 + publishable key 移行でゲートウェイ組み込み verify_jwt が user JWT を拒否する事象に対し、新規 Edge Function は verify_jwt=false + 関数内 sb.auth.getUser(jwt) 検証をデフォルトにするルールを rules/supabase-access.md に追記した。

## root_cause
Supabase の鍵方式移行によりゲートウェイ検証と ES256 署名の互換性が崩れ、401 Invalid JWT が発生していた

## countermeasure
関数内検証パターンをルール化し、401 のレスポンス形式でゲートウェイ/関数コードの出所を切り分ける手順も文書化

## result
同じハマりを繰り返さない体制ができ、google-calendar-proxy / ai-agent で実績が積まれた

<!-- id: 15bd70ed-1c1f-4576-8fd9-810a788ee759 -->
