# growth_events — Markdown ミラー

> Supabase `growth_events` テーブルの読み取り専用ミラー。
> 毎日 `scripts/growth/export-mirror.sh` で再生成される。**手編集しない**（次回上書きされる）。

- 総レコード数: **383**

## PJ別

- [agent-harness](by-project/agent-harness.md) — 28件
- [claude-dev](by-project/claude-dev.md) — 217件
- [focus-you](by-project/focus-you.md) — 83件
- [polaris-circuit](by-project/polaris-circuit.md) — 26件
- [rikyu](by-project/rikyu.md) — 29件

## 最近の20件

| date | type | project | title |
|---|---|---|---|
| 2026-04-23 | `failure` | focus-you | researchタブが画面に表示されない |
| 2026-04-23 | `failure` | focus-you | focus-youタブが重複・役割不明瞭 |
| 2026-04-23 | `decision` | rikyu | メタ記号（R-12/G-1等）の廃止 |
| 2026-04-23 | `failure` | rikyu | 過去の修正依頼が反映されない |
| 2026-04-23 | `failure` | claude-dev | 情報収集の鮮度とスコープ不足 |
| 2026-04-23 | `failure` | claude-dev | カレンダー表示のリグレッション |
| 2026-04-23 | `countermeasure` | rikyu | system-specドキュメントを上流→下流に再整理 |
| 2026-04-23 | `decision` | focus-you | focus-youのタブ構成を全体再設計 |
| 2026-04-23 | `failure` | rikyu | rikyu体験設計の過去修正が反映されていない |
| 2026-04-23 | `failure` | claude-dev | PR勝手マージの禁止違反 |
| 2026-04-23 | `failure` | focus-you | ダッシュボードのカレンダー表示が壊れた |
| 2026-04-23 | `failure` | claude-dev | PRを勝手にマージした |
| 2026-04-23 | `countermeasure` | rikyu | ドキュメントのメタ情報記号廃止 |
| 2026-04-23 | `failure` | claude-dev | カレンダー参照が不可に回帰 |
| 2026-04-23 | `failure` | claude-dev | 情報収集が古く・スコープ狭い |
| 2026-04-23 | `failure` | focus-you | focus-youタブ重複・分担不明 |
| 2026-04-23 | `failure` | claude-dev | PR作成後に無断マージ |
| 2026-04-23 | `decision` | rikyu | メタ記号での説明を禁止、丁寧な表現へ |
| 2026-04-23 | `failure` | focus-you | カレンダー表示デグレ |
| 2026-04-23 | `failure` | claude-dev | 情報収集で古い日付の情報を提示 |

## 運用ルール
- マスター: Supabase `growth_events`
- 書き込み: `scripts/growth/record.sh` or `daily-growth-digest` バッチ
- 詳細: `.claude/rules/growth-events.md`

