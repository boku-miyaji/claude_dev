# growth_events — Markdown ミラー

> Supabase `growth_events` テーブルの読み取り専用ミラー。
> 毎日 `scripts/growth/export-mirror.sh` で再生成される。**手編集しない**（次回上書きされる）。

- 総レコード数: **352**

## PJ別

- [agent-harness](by-project/agent-harness.md) — 28件
- [claude-dev](by-project/claude-dev.md) — 201件
- [focus-you](by-project/focus-you.md) — 76件
- [polaris-circuit](by-project/polaris-circuit.md) — 26件
- [rikyu](by-project/rikyu.md) — 21件

## 最近の20件

| date | type | project | title |
|---|---|---|---|
| 2026-04-22 | `countermeasure` | claude-dev | growth-detector に system-generated プロンプトの除外フィルタを追加 |
| 2026-04-22 | `countermeasure` | claude-dev | Supabase Edge Function 認証は verify_jwt=false + 関数内 getUser() を標準化 |
| 2026-04-22 | `decision` | focus-you | focus-you プロダクトビジョンは自己理解・幸せ・物語 |
| 2026-04-22 | `decision` | claude-dev | LLMコスト分離の原則（ダッシュボード/バッチ/Hook で用途別モデル） |
| 2026-04-21 | `milestone` | claude-dev | llm-retroactive batch marker (2026-04-21) |
| 2026-04-21 | `decision` | claude-dev | 定額プランでのバッチ実行の是非検討 |
| 2026-04-21 | `failure` | focus-you | ideasテーブルのマイグレーションが未適用 |
| 2026-04-21 | `decision` | focus-you | 名言セクションをGrowth示唆から分離 |
| 2026-04-21 | `failure` | claude-dev | ナラティブAI競合調査Agentがストール |
| 2026-04-21 | `failure` | agent-harness | Prompt classification hook stuck in infinite retry loop |
| 2026-04-21 | `failure` | claude-dev | Prompt classification instruction repeated twice |
| 2026-04-21 | `failure` | claude-dev | Hook内プロンプト分類が無限ループ |
| 2026-04-21 | `failure` | agent-harness | Hook infinite retry loop on correction signals |
| 2026-04-20 | `milestone` | claude-dev | llm-retroactive batch marker (2026-04-20) |
| 2026-04-20 | `decision` | claude-dev | 処理フロー・使用モデルをdocs/README化 |
| 2026-04-20 | `decision` | rikyu | 共通ナレッジ化はコア抽象化+silver層モジュール化 |
| 2026-04-20 | `decision` | rikyu | Phase2の3行対応は型活用で工数削減 |
| 2026-04-20 | `countermeasure` | rikyu | 見積もりは根拠+月単価で説明する |
| 2026-04-20 | `decision` | rikyu | rikyu 4行対応見積もりを4区分で構造化 |
| 2026-04-19 | `milestone` | claude-dev | llm-retroactive batch marker (2026-04-19) |

## 運用ルール
- マスター: Supabase `growth_events`
- 書き込み: `scripts/growth/record.sh` or `daily-growth-digest` バッチ
- 詳細: `.claude/rules/growth-events.md`

