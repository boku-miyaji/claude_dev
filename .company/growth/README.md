# growth_events — Markdown ミラー

> Supabase `growth_events` テーブルの読み取り専用ミラー。
> 毎日 `scripts/growth/export-mirror.sh` で再生成される。**手編集しない**（次回上書きされる）。

- 総レコード数: **590**

## PJ別

- [agent-harness](by-project/agent-harness.md) — 29件
- [claude-dev](by-project/claude-dev.md) — 296件
- [focus-you](by-project/focus-you.md) — 146件
- [polaris-circuit](by-project/polaris-circuit.md) — 39件
- [rikyu](by-project/rikyu.md) — 79件
- [unclassified](by-project/unclassified.md) — 1件

## 最近の20件

| date | type | project | title |
|---|---|---|---|
| 2026-05-02 | `decision` | rikyu | rikyu W1 は案A採用・7軸統一 vertical slice 戦略 |
| 2026-05-02 | `decision` | claude-dev | Zenn記事は説明責任の濃淡を許容（LLM活用の境界） |
| 2026-05-02 | `decision` | rikyu | rikyu MVP デプロイは Azure Portal 経由で進める |
| 2026-05-02 | `failure` | claude-dev | [batch failure] Intelligence Collection (2026-05-02) |
| 2026-05-02 | `failure` | claude-dev | [batch failure] News Collection (2026-05-02) |
| 2026-05-02 | `failure` | claude-dev | [batch failure] Calendar Sync (Every 30min) (2026-05-02) |
| 2026-05-02 | `countermeasure` | claude-dev | Zenn記事の文体・構造を全面校正 |
| 2026-05-02 | `failure` | focus-you | focus-you請求書が修正不可+入金日欄なし |
| 2026-05-02 | `decision` | claude-dev | LLM活用の境界=説明責任 |
| 2026-05-02 | `decision` | rikyu | rikyu UI設計はDDLに合わせる(案A採用) |
| 2026-05-02 | `decision` | rikyu | rikyu MVP Secret管理はContainer Apps Secretsで |
| 2026-05-02 | `decision` | claude-dev | 説明責任の濃淡を許容する（全部説明できなくてよい） |
| 2026-05-02 | `failure` | focus-you | focus-you 請求書が修正不可・入金日入力欄なし |
| 2026-05-02 | `decision` | claude-dev | Zenn記事の中核主張: 説明責任を取れればLLMをいくら使ってもよい |
| 2026-05-02 | `decision` | rikyu | rikyu W1 は案A採用・7軸統一・Vertical Slice 戦略 |
| 2026-05-02 | `decision` | rikyu | rikyu MVP デプロイは Azure Portal 経由で進める |
| 2026-05-01 | `decision` | rikyu | rikyu MVP CI/CD は SP なし build/push のみ |
| 2026-05-01 | `milestone` | rikyu | rikyu MVP デプロイセッション完了 |
| 2026-05-01 | `countermeasure` | rikyu | Docker multi-stage uv の venv path 不一致対策 |
| 2026-05-01 | `failure` | claude-dev | [batch failure] Intelligence Collection (2026-05-01) |

## 運用ルール
- マスター: Supabase `growth_events`
- 書き込み: `scripts/growth/record.sh` or `daily-growth-digest` バッチ
- 詳細: `.claude/rules/growth-events.md`

