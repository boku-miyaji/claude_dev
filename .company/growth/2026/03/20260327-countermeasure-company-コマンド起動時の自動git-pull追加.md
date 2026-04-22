# /company コマンド起動時の自動git pull追加

- **type**: `countermeasure`
- **date**: 2026-03-27
- **category**: automation / **severity**: medium
- **status**: active
- **source**: backfill
- **tags**: hooks, company, sync, agent-harness
- **commits**: f2fc805

## what_happened
複数サーバー間で claude_dev リポジトリの状態が同期されず /company スラッシュコマンドが認識されない問題が発生。hook で /company 実行時に自動 git pull する仕組みを追加した。

## root_cause
複数環境で手動 pull が必要で、同期漏れがスラッシュコマンド認識不全の原因になっていた

## countermeasure
company-pull.sh hook を新設し /company 実行前に自動 pull。併せて config-sync / sync-slash-commands の整備

## result
clone 直後のサーバーでも /company が利用可能になる導線を確保

<!-- id: ff707ac9-160a-41f4-9240-6c30e73e5323 -->
