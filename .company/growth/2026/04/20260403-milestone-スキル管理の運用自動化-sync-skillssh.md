# スキル管理の運用自動化 — sync-skills.sh

- **type**: `milestone`
- **date**: 2026-04-03
- **category**: devops / **severity**: medium
- **status**: resolved
- **source**: manual
- **tags**: devops, skills, automation, sync-script, claude-dev
- **commits**: 041bbcf

## what_happened
スキルの追加・変更のたびにmarketplace.jsonの手動編集、キャッシュの手動コピー、整合性の手動チェックが必要で、ミスが頻発していた。

## countermeasure
sync-skills.sh ワンコマンドで marketplace.json 自動生成 + 全キャッシュ同期 + 整合性チェックを実行。skill-managementルールも策定し、「手動編集禁止」を明文化。

## result
運用手順の自動化は「ミスが2回起きた時点」で投資すべき。手動手順は必ず劣化する。

<!-- id: 92cc5f6f-d5c3-41bf-9c34-7cc081069913 -->
