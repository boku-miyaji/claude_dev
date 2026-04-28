# YAML 検証スクリプトは regex でなく PyYAML safe_load で読む（format に依存しない）

- **type**: `countermeasure`
- **date**: 2026-04-28
- **category**: devops / **severity**: high
- **status**: active
- **source**: manual
- **tags**: claude-dev, github-actions, yaml, validation, batch, manual-record
- **parent_id**: `8e7abbc6-5587-4082-b7a5-a23c29b046a3`

## what_happened
news-collect 失敗の根本原因が check-arxiv-sync.sh の python regex が categories の flow style しか想定していなかったこと。auto-save が YAML を block style に書き換えても壊れない検証手段が必要。

## countermeasure
check-arxiv-sync.sh を python regex から PyYAML の yaml.safe_load() ベースに変更し、flow / block / 混在のいずれの format でも keywords/categories を抽出できるようにした (commit 44389e6c)。pyyaml が無い環境では自動 pip install。同種スクリプトの将来追加時も regex でなく yaml.safe_load を必須とする。

## result
ローカルで keywords 11/11, categories 5 一致を検証済み。次回スケジュール実行 (21:00 UTC = 06:00 JST) で news-collect 復旧見込み。

<!-- id: a06152ef-31a0-4f2c-9479-0e95c4ba5a36 -->
