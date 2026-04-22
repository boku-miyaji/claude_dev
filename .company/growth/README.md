# growth_events — Markdown ミラー

> Supabase `growth_events` テーブルの読み取り専用ミラー。
> 毎日 `scripts/growth/export-mirror.sh` で再生成される。**手編集しない**（次回上書きされる）。

- 総レコード数: **198**

## PJ別

- [focus-you](by-project/focus-you.md) — 5件
- [unclassified](by-project/unclassified.md) — 193件

## 最近の20件

| date | type | project | title |
|---|---|---|---|
| 2026-04-21 | `failure` | - | Prompt classification hook stuck in infinite retry loop |
| 2026-04-21 | `failure` | - | Prompt classification instruction repeated twice |
| 2026-04-21 | `failure` | - | Hook内プロンプト分類が無限ループ |
| 2026-04-21 | `failure` | - | Hook infinite retry loop on correction signals |
| 2026-04-19 | `milestone` | - | Claude Code論文からAI Agent設計原則を体系化 |
| 2026-04-19 | `milestone` | focus-you | silence-first AI設計原則の確立とNarrator実装 |
| 2026-04-19 | `milestone` | focus-you | focus-you/roots: 自然文入力+時系列タイムラインUI |
| 2026-04-19 | `failure` | - | Hook自己再帰ループ（growth-detector） |
| 2026-04-19 | `failure` | - | Hook infinite loop: correction signals repeating themselves |
| 2026-04-19 | `failure` | - | Hook自己再帰ループ（分類・分析プロンプトの無限反復） |
| 2026-04-19 | `failure` | - | Prompt classification hook stuck in retry loop |
| 2026-04-19 | `failure` | - | Hook分類・分析プロンプトの無限再帰ループ |
| 2026-04-19 | `failure` | - | Hook recursive loop: classify/analyze hooks re-triggering themselves |
| 2026-04-19 | `failure` | - | Hook recursive loop: classifier/analyzer re-triggering itself |
| 2026-04-19 | `failure` | - | Hook recursive loop: correction signals feed back into themselves |
| 2026-04-17 | `failure` | - | Hook infinite retry loop on classification prompt |
| 2026-04-17 | `failure` | - | Prompt分類Hookが無限リトライループ |
| 2026-04-16 | `countermeasure` | - | AI Partnerの不自然な日本語をプロンプトで防止 |
| 2026-04-16 | `failure` | - | Prompt classification batch job flooding correction signals |
| 2026-04-16 | `failure` | - | Batch classifier prompts misclassified as user corrections |

## 運用ルール
- マスター: Supabase `growth_events`
- 書き込み: `scripts/growth/record.sh` or `daily-growth-digest` バッチ
- 詳細: `.claude/rules/growth-events.md`

