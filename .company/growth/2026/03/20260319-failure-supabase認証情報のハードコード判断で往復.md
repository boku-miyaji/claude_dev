# Supabase認証情報のハードコード判断で往復

- **type**: `failure`
- **date**: 2026-03-19
- **category**: security / **severity**: medium
- **status**: active
- **source**: backfill
- **tags**: learning, supabase, anon-key, rls
- **commits**: 9389f17, e5daec3

## what_happened
Supabase認証情報をハードコードから削除しSetup画面に移行したが、その後「publishable keyは仕様上公開前提」と判断を改めてハードコードを復元。セキュリティモデルの理解不足から一往復が発生した。

## root_cause
Supabase publishable key(anon key) が公開前提である仕様の理解が初期段階で不十分だった

## countermeasure
publishable key は公開OK、本当の防御は RLS + user_id 分離で担保する方針に整理

## result
RLSベースのセキュリティモデルに設計が収束

<!-- id: 4099cf8b-e8ca-4573-8073-1ca59d7baaa2 -->
