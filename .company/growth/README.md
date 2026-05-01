# growth_events — Markdown ミラー

> Supabase `growth_events` テーブルの読み取り専用ミラー。
> 毎日 `scripts/growth/export-mirror.sh` で再生成される。**手編集しない**（次回上書きされる）。

- 総レコード数: **563**

## PJ別

- [agent-harness](by-project/agent-harness.md) — 29件
- [claude-dev](by-project/claude-dev.md) — 284件
- [focus-you](by-project/focus-you.md) — 143件
- [polaris-circuit](by-project/polaris-circuit.md) — 39件
- [rikyu](by-project/rikyu.md) — 67件
- [unclassified](by-project/unclassified.md) — 1件

## 最近の20件

| date | type | project | title |
|---|---|---|---|
| 2026-05-01 | `milestone` | rikyu | rikyu MVP デプロイセッション完了 |
| 2026-05-01 | `failure` | rikyu | Azure ロール割り当て権限不足で停滞 |
| 2026-05-01 | `failure` | rikyu | Service Bus 名 rikyu-dev-sbus も他テナント衝突、aces- プレフィックス追加で確定 |
| 2026-05-01 | `countermeasure` | claude-dev | Docker multi-stage + uv で venv path 不一致による startup 失敗 |
| 2026-05-01 | `milestone` | rikyu | rikyu MVP API + Worker のコア実装完了 (FastAPI + 17 endpoint, 2 job handler, 9 tests passing) |
| 2026-05-01 | `decision` | rikyu | rikyu MVP の CI/CD は SP なしで build & push のみ自動化、deploy は local az CLI で社長実行 |
| 2026-04-30 | `decision` | polaris-circuit | polaris-circuit のDB方針を再検討 |
| 2026-04-30 | `decision` | claude-dev | 「社長」呼称を恒久的に廃止 |
| 2026-04-30 | `failure` | claude-dev | auto-push が SSH名前解決失敗で20件未push |
| 2026-04-30 | `failure` | claude-dev | [batch failure] Intelligence Collection (2026-04-30) |
| 2026-04-30 | `failure` | claude-dev | [batch failure] News Collection (2026-04-30) |
| 2026-04-30 | `decision` | rikyu | Azure OpenAI は既存 Foundry (Australia East) を再利用、East US 2 新設は Phase 1 中盤で再判断 |
| 2026-04-30 | `decision` | rikyu | rikyu MVP の Secret 管理は Container Apps Secrets でスタート、Phase 1 中盤で Key Vault 化 |
| 2026-04-30 | `decision` | - | CVE-2026-31431 (Copy Fail) 対応方針: マネージド依存 + 開発環境 algif_aead 無効化 |
| 2026-04-30 | `decision` | claude-dev | 作業環境投資 (椅子・キーボード相棒選定) |
| 2026-04-30 | `decision` | claude-dev | 「社長」呼称を恒久的に廃止 |
| 2026-04-30 | `decision` | rikyu | Azure pg flexible server構成の再検討 |
| 2026-04-30 | `failure` | claude-dev | auto-pushアラート再発 (SSH/DNS解決失敗) |
| 2026-04-30 | `failure` | polaris-circuit | Docker build失敗 (kicad-cli/python3) |
| 2026-04-30 | `countermeasure` | claude-dev | 「社長」呼称を廃止、二人称は『あなた』 |

## 運用ルール
- マスター: Supabase `growth_events`
- 書き込み: `scripts/growth/record.sh` or `daily-growth-digest` バッチ
- 詳細: `.claude/rules/growth-events.md`

