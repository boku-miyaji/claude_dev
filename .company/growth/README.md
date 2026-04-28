# growth_events — Markdown ミラー

> Supabase `growth_events` テーブルの読み取り専用ミラー。
> 毎日 `scripts/growth/export-mirror.sh` で再生成される。**手編集しない**（次回上書きされる）。

- 総レコード数: **509**

## PJ別

- [agent-harness](by-project/agent-harness.md) — 29件
- [claude-dev](by-project/claude-dev.md) — 261件
- [focus-you](by-project/focus-you.md) — 140件
- [polaris-circuit](by-project/polaris-circuit.md) — 28件
- [rikyu](by-project/rikyu.md) — 51件

## 最近の20件

| date | type | project | title |
|---|---|---|---|
| 2026-04-28 | `decision` | polaris-circuit | polaris-circuit: 散らかった開発の整理着手 |
| 2026-04-28 | `failure` | claude-dev | 情報収集部の出力が古く新規性ゼロ |
| 2026-04-28 | `failure` | focus-you | focus-you: 日記からの自動チェックが反映されない |
| 2026-04-28 | `decision` | rikyu | rikyu: Azure AI Search + PostgreSQL採用 |
| 2026-04-28 | `decision` | rikyu | rikyu: monorepo構成 + Container Apps採用 |
| 2026-04-28 | `decision` | polaris-circuit | polaris-circuit 検証再開とブランチ整理 |
| 2026-04-28 | `decision` | rikyu | rikyu インフラを Azure monorepo 構成で進める |
| 2026-04-28 | `failure` | focus-you | focus-you 観葉植物水やり habit のチェック不能 |
| 2026-04-28 | `decision` | rikyu | rikyu アーキテクチャ: monorepo + FE/BE 分離 + TS統一 |
| 2026-04-28 | `countermeasure` | claude-dev | YAML 検証スクリプトは regex でなく PyYAML safe_load で読む（format に依存しない） |
| 2026-04-28 | `failure` | claude-dev | news-collect ワークフローが check-arxiv-sync.sh の YAML format 想定不一致で 5日間 silent failure |
| 2026-04-27 | `milestone` | focus-you | focus-you Calendar UIを24時間表示+自動スクロール化 |
| 2026-04-27 | `countermeasure` | claude-dev | auto-pushに巨大ファイル/build artifactsガードを追加 |
| 2026-04-27 | `failure` | claude-dev | 巨大ファイルがauto-saveでpush rejectされた |
| 2026-04-27 | `failure` | claude-dev | [batch failure] News Collection (2026-04-26) |
| 2026-04-27 | `failure` | claude-dev | [batch failure] Morning Quote (Daily) (2026-04-26) |
| 2026-04-27 | `failure` | claude-dev | [batch failure] Narrator Update (Daily) (2026-04-27) |
| 2026-04-27 | `failure` | claude-dev | [batch failure] Intelligence Collection (2026-04-27) |
| 2026-04-27 | `failure` | claude-dev | [batch failure] News Collection (2026-04-27) |
| 2026-04-27 | `failure` | claude-dev | Edge Function /calendars が OAuth スコープ不足で 403 |

## 運用ルール
- マスター: Supabase `growth_events`
- 書き込み: `scripts/growth/record.sh` or `daily-growth-digest` バッチ
- 詳細: `.claude/rules/growth-events.md`

