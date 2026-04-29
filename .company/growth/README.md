# growth_events — Markdown ミラー

> Supabase `growth_events` テーブルの読み取り専用ミラー。
> 毎日 `scripts/growth/export-mirror.sh` で再生成される。**手編集しない**（次回上書きされる）。

- 総レコード数: **520**

## PJ別

- [agent-harness](by-project/agent-harness.md) — 29件
- [claude-dev](by-project/claude-dev.md) — 266件
- [focus-you](by-project/focus-you.md) — 141件
- [polaris-circuit](by-project/polaris-circuit.md) — 30件
- [rikyu](by-project/rikyu.md) — 54件

## 最近の20件

| date | type | project | title |
|---|---|---|---|
| 2026-04-29 | `decision` | focus-you | manualタブ再生成結果の編集機能と編集履歴ログ追加 |
| 2026-04-29 | `decision` | polaris-circuit | polaris-circuit: gemini-3-pro-previewでパイプライン検証開始 |
| 2026-04-29 | `decision` | rikyu | りそな案件: ACES Meet連携はFY26手動着手 |
| 2026-04-29 | `decision` | rikyu | りそな案件: 7軸評価フレームワークと5つの勝ち筋ループの統合整理 |
| 2026-04-28 | `countermeasure` | claude-dev | auto-push を current branch push に変更 |
| 2026-04-28 | `decision` | rikyu | rikyu を Azure monorepo + Container Apps で進める |
| 2026-04-28 | `decision` | polaris-circuit | polaris-circuit の散らかった開発を整理して検証再開 |
| 2026-04-28 | `failure` | claude-dev | [batch failure] Intelligence Collection (2026-04-28) |
| 2026-04-28 | `failure` | claude-dev | [batch failure] News Collection (2026-04-28) |
| 2026-04-28 | `countermeasure` | claude-dev | 情報収集部 collect.py を 公式RSS+arXiv API+24h縛り+前回差分+Claude CLI(opus)構成にリファクタ |
| 2026-04-28 | `failure` | claude-dev | /company が情報収集部 agent に渡すプロンプトを Claude judgement で再構築し、リサーチ部規約を混入させた |
| 2026-04-28 | `decision` | polaris-circuit | polaris-circuit: 散らかった開発の整理着手 |
| 2026-04-28 | `failure` | claude-dev | 情報収集部の出力が古く新規性ゼロ |
| 2026-04-28 | `failure` | focus-you | focus-you: 日記からの自動チェックが反映されない |
| 2026-04-28 | `decision` | rikyu | rikyu: Azure AI Search + PostgreSQL採用 |
| 2026-04-28 | `decision` | rikyu | rikyu: monorepo構成 + Container Apps採用 |
| 2026-04-28 | `decision` | polaris-circuit | polaris-circuit 検証再開とブランチ整理 |
| 2026-04-28 | `decision` | rikyu | rikyu インフラを Azure monorepo 構成で進める |
| 2026-04-28 | `failure` | focus-you | focus-you 観葉植物水やり habit のチェック不能 |
| 2026-04-28 | `decision` | rikyu | rikyu アーキテクチャ: monorepo + FE/BE 分離 + TS統一 |

## 運用ルール
- マスター: Supabase `growth_events`
- 書き込み: `scripts/growth/record.sh` or `daily-growth-digest` バッチ
- 詳細: `.claude/rules/growth-events.md`

