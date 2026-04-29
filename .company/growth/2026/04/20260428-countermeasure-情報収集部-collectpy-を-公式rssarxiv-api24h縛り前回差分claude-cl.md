# 情報収集部 collect.py を 公式RSS+arXiv API+24h縛り+前回差分+Claude CLI(opus)構成にリファクタ

- **type**: `countermeasure`
- **date**: 2026-04-28
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: manual
- **tags**: claude-dev, intelligence, rss, arxiv, llm-compose, prompt-log, manual-record

## what_happened
ハルシ温床のキーワード検索のみだった collect.py を全面改修。sources_fetch.py(RSS/arXiv)、llm_compose.py(Claude CLI opus)を新設。pytest 22件 pass。実 fetch で arxiv 6件・公式RSS 12件取得確認

## countermeasure
(1) 公式 RSS 4社 (OpenAI/Google/DeepMind/HuggingFace) を feedparser で fetch、(2) arxiv 公式 API でカテゴリ+キーワード横断 fetch、(3) 24h縛り → 不足時に72h/1week/2weeks 段階遡り、(4) 過去レポートとの差分(URL重複除外)、(5) prompt_log 直近7日から動的キーワード抽出、(6) Claude CLI (opus) で要約・focus-you/hd-ops 示唆生成、(7) LLM不可時はスケルトン(ハルシ抑止)

## result
ローカル単体テスト 22/22 pass。実 fetch smoke OK。GitHub Actions 動作確認は workflow_dispatch 権限不足のため社長依頼 or 21:00 cron 待ち。Anthropic/Meta は公式RSSなしのため別タスクで HTML スクレイピング対応

<!-- id: 63910dfe-2534-4fd5-83b0-b2cbdb579c03 -->
