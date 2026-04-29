# news-collect ワークフローが check-arxiv-sync.sh の YAML format 想定不一致で 5日間 silent failure

- **type**: `failure`
- **date**: 2026-04-28
- **category**: devops / **severity**: high
- **status**: resolved
- **source**: manual
- **tags**: claude-dev, github-actions, batch, yaml, silent-failure, news-collect, intelligence, manual-record

## what_happened
2026-04-22 の auto-save commit 74a6f898 で sources.yaml が flow style (categories: [cs.AI, ...]) からブロック style (categories:
- cs.AI
...) に再フォーマットされた。scripts/intelligence/check-arxiv-sync.sh の python regex 'categories:\s*\[(.*?)\]' が flow style しかマッチしないため、4/23 06:00 JST 以降 'categories list not found' で exit 1 → news-collect が10連続失敗 → news_items が4日間 0件更新。workflow-failure-watch は growth_events に記録していたが、/company 起動時のブリーフィングで浮上せず社長が4/28 朝の '情報収集して' 依頼の延長で気づくまで silent。

## root_cause
(1) check-arxiv-sync.sh が YAML format に regex 依存。(2) auto-save が yaml ファイルを reformat する副作用。(3) growth_events に記録された batch failure が /company ブリーフィングで surface されていない（記録→表示が切れている）

## countermeasure
(1) commit 44389e6c: scripts/intelligence/check-arxiv-sync.sh を PyYAML safe_load 化し flow/block 両方の YAML format に対応。(2) commit 14a9f6a6: /company ブリーフィングで growth_events.failure (severity=high, 3日以内) を surface するよう SKILL.md を更新。記録↔表示の断絶を解消。次回 schedule run (UTC 06:00 / 22:00) で動作検証。

<!-- id: 8e7abbc6-5587-4082-b7a5-a23c29b046a3 -->
