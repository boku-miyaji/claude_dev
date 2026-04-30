# growth_events — Markdown ミラー

> Supabase `growth_events` テーブルの読み取り専用ミラー。
> 毎日 `scripts/growth/export-mirror.sh` で再生成される。**手編集しない**（次回上書きされる）。

- 総レコード数: **549**

## PJ別

- [agent-harness](by-project/agent-harness.md) — 29件
- [claude-dev](by-project/claude-dev.md) — 279件
- [focus-you](by-project/focus-you.md) — 143件
- [polaris-circuit](by-project/polaris-circuit.md) — 38件
- [rikyu](by-project/rikyu.md) — 60件

## 最近の20件

| date | type | project | title |
|---|---|---|---|
| 2026-04-30 | `decision` | claude-dev | 作業環境投資 (椅子・キーボード相棒選定) |
| 2026-04-30 | `decision` | claude-dev | 「社長」呼称を恒久的に廃止 |
| 2026-04-30 | `decision` | rikyu | Azure pg flexible server構成の再検討 |
| 2026-04-30 | `failure` | claude-dev | auto-pushアラート再発 (SSH/DNS解決失敗) |
| 2026-04-30 | `failure` | polaris-circuit | Docker build失敗 (kicad-cli/python3) |
| 2026-04-30 | `countermeasure` | claude-dev | 「社長」呼称を廃止、二人称は『あなた』 |
| 2026-04-30 | `decision` | rikyu | Azure PostgreSQL Flexible Server 構成見直し |
| 2026-04-30 | `failure` | polaris-circuit | polaris-circuit Dockerfile ビルド失敗 |
| 2026-04-30 | `failure` | claude-dev | auto-push が SSH 名前解決失敗で20件未push |
| 2026-04-30 | `decision` | claude-dev | Zenn記事「LLM時代のエンジニアリング論」企画 |
| 2026-04-30 | `decision` | claude-dev | 「社長」呼称を全面廃止 |
| 2026-04-30 | `failure` | claude-dev | Azure CLI macOSインストール失敗 |
| 2026-04-30 | `failure` | polaris-circuit | KiCad 8でDockerビルド失敗・Dockerfile警告 |
| 2026-04-30 | `decision` | claude-dev | Zenn記事「LLM時代のエンジニア論」執筆方針 |
| 2026-04-30 | `failure` | focus-you | ブリーフィングのカレンダー予定が実態と乖離 |
| 2026-04-30 | `failure` | claude-dev | Azure CLI インストール経路が機能しない |
| 2026-04-30 | `failure` | polaris-circuit | Dockerfile kicad-cli インストール失敗 |
| 2026-04-30 | `decision` | rikyu | Azure PostgreSQL からMS製/NoSQL検討へ転換 |
| 2026-04-30 | `decision` | rikyu | Azure DB は PostgreSQL Flexible Server を再検討（コスト高） |
| 2026-04-30 | `failure` | rikyu | Azure CLI認証エラー53003 |

## 運用ルール
- マスター: Supabase `growth_events`
- 書き込み: `scripts/growth/record.sh` or `daily-growth-digest` バッチ
- 詳細: `.claude/rules/growth-events.md`

