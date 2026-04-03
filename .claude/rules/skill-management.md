# スキル管理ルール

## ソース・オブ・トゥルース

`~/.claude/plugins/marketplaces/ai-company/` が唯一の正。他のコピーは同期スクリプトで生成する。

## スキル追加手順

1. `~/.claude/plugins/marketplaces/ai-company/skills/{name}/SKILL.md` を作成
2. `bash scripts/company/sync-skills.sh` を実行（marketplace.json自動更新 + 全キャッシュに同期）
3. **次のセッションから有効**（セッション開始時にmarketplace.jsonが読み込まれるため）

## やってはいけないこと

- marketplace.json を手動編集しない（sync-skills.sh が自動生成する）
- キャッシュの SKILL.md を直接編集しない（ソースを編集してsyncする）
- CLAUDE.md に運用手順を書かない（スキルに閉じ込める）

## スキル設計の原則

- **descriptionが全て**: セッション中はdescriptionだけでスキル選択が判断される。具体的に書く
- **triggerを明記**: frontmatterの `trigger: /コマンド名` でユーザーが明示的に呼べるようにする
- **知識の閉じ込め**: 手順・注意事項はスキル内に書く。CLAUDE.mdやmemorに分散させない

## 整合性チェック

`bash scripts/company/sync-skills.sh --check` でスキルディレクトリとmarketplace.json、全キャッシュの整合性を確認できる。
