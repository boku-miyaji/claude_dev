# Edge Function即時自動デプロイ

- **type**: `milestone`
- **date**: 2026-04-07
- **category**: automation / **severity**: medium
- **status**: active
- **source**: backfill
- **tags**: edge-function, hooks, devops
- **commits**: 38a6b53, 2f0b5f9

## what_happened
supabase/functions編集後のデプロイ忘れを防ぐため、session stop時デプロイ→さらに編集直後の即時デプロイに進化させた。

## root_cause
Edge Function編集後にデプロイを忘れ、ローカルと本番が乖離する事故が頻発

## countermeasure
edge-function-deploy.sh hookを session stop 発火から edit 直後発火に変更

## result
編集とデプロイが1セットで完結、乖離リスクが消滅

<!-- id: 961e5fd7-7b69-4b99-af71-e7bbee061140 -->
