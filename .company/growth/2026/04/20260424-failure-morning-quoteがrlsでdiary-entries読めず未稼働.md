# morning-quoteがRLSでdiary_entries読めず未稼働

- **type**: `failure`
- **date**: 2026-04-24
- **category**: devops / **severity**: medium
- **status**: active
- **source**: daily-digest
- **tags**: focus-you, supabase, rls, auto-detected, daily-digest
- **commits**: ab829fb

## what_happened
morning-quoteバッチがRLSによりdiary_entriesテーブルの読み取りをブロックされており、長期間動作していなかったことが発覚。RLS適用テーブルへのバッチアクセスでkey選定が誤っていた。

## root_cause
RLS対象テーブルへのアクセスにanon keyを使い、空配列を「データなし」と誤判定していた

## countermeasure
x-ingest-key経由のアクセスに修正してmorning-quoteを復旧

## result
morning-quoteがdiary_entriesを正しく取得できるようになった

<!-- id: 4a67464c-a1c4-491b-882c-0eda31e80baf -->
