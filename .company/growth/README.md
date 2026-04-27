# growth_events — Markdown ミラー

> Supabase `growth_events` テーブルの読み取り専用ミラー。
> 毎日 `scripts/growth/export-mirror.sh` で再生成される。**手編集しない**（次回上書きされる）。

- 総レコード数: **485**

## PJ別

- [agent-harness](by-project/agent-harness.md) — 29件
- [claude-dev](by-project/claude-dev.md) — 246件
- [focus-you](by-project/focus-you.md) — 137件
- [polaris-circuit](by-project/polaris-circuit.md) — 26件
- [rikyu](by-project/rikyu.md) — 47件

## 最近の20件

| date | type | project | title |
|---|---|---|---|
| 2026-04-26 | `milestone` | focus-you | focus-you を design-spec 準拠に全面改修 |
| 2026-04-26 | `milestone` | focus-you | Proactive Prelude 導入 (silence-first × proactive) |
| 2026-04-26 | `decision` | focus-you | Sidebar を 180px + CLI 折りたたみに整理 |
| 2026-04-25 | `failure` | rikyu | rikyu外部開発者向け仕様の6ブロッカー |
| 2026-04-25 | `failure` | focus-you | focus-youモバイルTODAY画面の品質問題 |
| 2026-04-25 | `decision` | rikyu | MAFとmagentic_pipelineのオーケストレーション差分を分析 |
| 2026-04-25 | `failure` | focus-you | モバイル TODAY 画面のUX破綻 |
| 2026-04-25 | `countermeasure` | claude-dev | 単純な結論を急がず深く分析する原則 |
| 2026-04-25 | `decision` | focus-you | 業務連動設計の早期着手が必要と判断 |
| 2026-04-25 | `failure` | focus-you | focus-youモバイルTODAY画面のUIが破綻 |
| 2026-04-25 | `decision` | focus-you | focus-you全ページにデザインシステムを反映 |
| 2026-04-25 | `failure` | focus-you | 推奨アルゴリズムの安易な結論を差し戻し |
| 2026-04-25 | `decision` | focus-you | 未実装ベータ機能を削除して確認可能状態に |
| 2026-04-25 | `failure` | rikyu | rikyu外部開発者向け6つの仕様ブロッカーが発覚 |
| 2026-04-25 | `failure` | focus-you | focus-you モバイルTODAY画面UIが破綻 |
| 2026-04-25 | `failure` | rikyu | WBI情報が分散し設計が固まらない |
| 2026-04-25 | `decision` | rikyu | MAF vs magentic_pipeline.py 用途切り分け議論 |
| 2026-04-25 | `decision` | focus-you | focus-youベータは未実装機能を削除してから確認 |
| 2026-04-25 | `failure` | rikyu | rikyu PJ仕様に外部開発者向け6ブロッカー検出 |
| 2026-04-25 | `decision` | focus-you | focus-you アルファ実装移行・壁打ちは翌日 |

## 運用ルール
- マスター: Supabase `growth_events`
- 書き込み: `scripts/growth/record.sh` or `daily-growth-digest` バッチ
- 詳細: `.claude/rules/growth-events.md`

