# anon SELECTポリシー撤廃、authenticatedのみに制限

- **type**: `countermeasure`
- **date**: 2026-03-23
- **category**: security / **severity**: critical
- **status**: active
- **source**: backfill
- **tags**: security, rls, supabase, claude-dev
- **commits**: 0cc70aa

## what_happened
Supabase RLSでanonロールに許可していたSELECTポリシーを全撤廃し、authenticatedロール限定に変更。未認証からの読み取り経路を遮断した。

## root_cause
初期設定でanon SELECTを広く許可しており、情報漏洩リスクがあった

## countermeasure
RLSポリシーを書き換え、authenticated限定に

## result
未認証アクセス経路をクローズ

<!-- id: 123149ae-18a5-4505-8f1d-08926b46dba0 -->
