# ニュース収集cron自動化を導入

- **type**: `milestone`
- **date**: 2026-04-10
- **category**: automation / **severity**: medium
- **status**: active
- **source**: backfill
- **tags**: cron, intelligence, github-actions, sse, claude-dev
- **commits**: 121e716, cf781ff

## what_happened
GitHub Actionsで06:00/18:00 JSTに走るnews-collect cronを新設し、intelligence部のレポート生成を自動化。SSEストリーミングレスポンスのパース不具合も同日中に修正した。

## root_cause
intelligence部のニュース収集を手動起動に依存しており、定期ブリーフィングの鮮度が不安定だった

## countermeasure
news-collect.ymlを追加しnewsCollect.tsでSSEパースを実装、cf781ffでストリーミング対応を修正

## result
1日2回の自動収集が稼働し、intelligenceレポートが定期生成されるようになった

<!-- id: f56bab42-2690-45aa-bdf9-ae6ea88bb7f0 -->
