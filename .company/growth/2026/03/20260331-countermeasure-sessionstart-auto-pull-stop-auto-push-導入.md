# SessionStart auto-pull / Stop auto-push 導入

- **type**: `countermeasure`
- **date**: 2026-03-31
- **category**: automation / **severity**: medium
- **status**: active
- **source**: backfill
- **tags**: hooks, git-automation, workflow, claude-dev
- **commits**: b67e612

## what_happened
セッション開始時に自動pull、レスポンス完了時に自動pushするHookを追加。手動同期の手間を排除し、複数環境間の変更反映を自動化した。

## root_cause
「pullはいつ？companyで自動同期される？」という社長の疑問。同期タイミングが不明瞭だった

## countermeasure
auto-pull.sh / auto-push.sh を追加し settings.json に登録

## result
毎レスポンス後に未コミット変更が自動保存される運用に

<!-- id: cb2e3e15-e3c2-49f2-8f3e-cd1268dd97b0 -->
