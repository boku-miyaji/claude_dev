# growth_events — Markdown ミラー

> Supabase `growth_events` テーブルの読み取り専用ミラー。
> 毎日 `scripts/growth/export-mirror.sh` で再生成される。**手編集しない**（次回上書きされる）。

- 総レコード数: **202**

## PJ別

- [agent-harness](by-project/agent-harness.md) — 28件
- [claude-dev](by-project/claude-dev.md) — 126件
- [focus-you](by-project/focus-you.md) — 36件
- [polaris-circuit](by-project/polaris-circuit.md) — 10件
- [rikyu](by-project/rikyu.md) — 2件

## 最近の20件

| date | type | project | title |
|---|---|---|---|
| 2026-04-22 | `countermeasure` | claude-dev | growth-detector に system-generated プロンプトの除外フィルタを追加 |
| 2026-04-22 | `countermeasure` | claude-dev | Supabase Edge Function 認証は verify_jwt=false + 関数内 getUser() を標準化 |
| 2026-04-22 | `decision` | focus-you | focus-you プロダクトビジョンは自己理解・幸せ・物語 |
| 2026-04-22 | `decision` | claude-dev | LLMコスト分離の原則（ダッシュボード/バッチ/Hook で用途別モデル） |
| 2026-04-21 | `failure` | agent-harness | Prompt classification hook stuck in infinite retry loop |
| 2026-04-21 | `failure` | claude-dev | Prompt classification instruction repeated twice |
| 2026-04-21 | `failure` | claude-dev | Hook内プロンプト分類が無限ループ |
| 2026-04-21 | `failure` | agent-harness | Hook infinite retry loop on correction signals |
| 2026-04-19 | `milestone` | agent-harness | Claude Code論文からAI Agent設計原則を体系化 |
| 2026-04-19 | `milestone` | focus-you | silence-first AI設計原則の確立とNarrator実装 |
| 2026-04-19 | `milestone` | focus-you | focus-you/roots: 自然文入力+時系列タイムラインUI |
| 2026-04-19 | `failure` | agent-harness | Hook自己再帰ループ（growth-detector） |
| 2026-04-19 | `failure` | agent-harness | Hook infinite loop: correction signals repeating themselves |
| 2026-04-19 | `failure` | agent-harness | Hook自己再帰ループ（分類・分析プロンプトの無限反復） |
| 2026-04-19 | `failure` | agent-harness | Prompt classification hook stuck in retry loop |
| 2026-04-19 | `failure` | claude-dev | Hook分類・分析プロンプトの無限再帰ループ |
| 2026-04-19 | `failure` | agent-harness | Hook recursive loop: classify/analyze hooks re-triggering themselves |
| 2026-04-19 | `failure` | agent-harness | Hook recursive loop: classifier/analyzer re-triggering itself |
| 2026-04-19 | `failure` | agent-harness | Hook recursive loop: correction signals feed back into themselves |
| 2026-04-17 | `failure` | agent-harness | Hook infinite retry loop on classification prompt |

## 運用ルール
- マスター: Supabase `growth_events`
- 書き込み: `scripts/growth/record.sh` or `daily-growth-digest` バッチ
- 詳細: `.claude/rules/growth-events.md`

