# ブリーフィング手順（詳細）

## 並列実行設計

起動時のデータ取得は **すべて並列** で実行する（Agentic Loop の複数ツール同時呼び出しを活用）。

```
[並列実行 — 全て独立、依存関係なし]
  ├── カレンダー取得（Google Calendar MCP）
  ├── コメント取得（Supabase curl）
  ├── タスク取得（Supabase curl）
  └── 鮮度チェック（freshness-check.sh）

[統合] → ブリーフィング表示
```

## カレンダー取得

**accessRole: owner の全カレンダー** からイベントを統合取得する。primary だけでは仕事の予定が漏れる。

**対象カレンダー:**
- `yumzzz.my6223@gmail.com`（primary・個人）
- `yuta.miyaji.xyz@gmail.com`（個人2）
- `yuta.miyaji@acesinc.co.jp`（ACES社・仕事）

**表示ルール:**
- **必ず `TZ=Asia/Tokyo date` で現在時刻を取得してから**状態判定する（推測しない）
- 現在時刻を基準に「完了」「進行中」「これから」を明示
- `[仕事]`/`[In]`/`[Ex]` タグ付きは仕事関連として強調

## コメント・タスク取得

**anon key + x-ingest-key ヘッダー** が必要（RLS のため）。

→ 具体的な curl コマンドは `references/supabase-queries.md` を参照

## データ鮮度チェック

**手順:**
1. `.claude/hooks/freshness-check.sh` を実行し、各データソースの最終更新日を取得
2. `.company/freshness-policy.yaml` のポリシーと照合し、stale（期限超過）を検出
3. ブリーフィングに鮮度レポートを含める
4. `auto_update: true` のstaleデータは、ブリーフィング後に自動更新を実行

**表示形式:**
```
📊 データ鮮度:
  ✅ intelligence — 最新（今朝 09:00）
  ⚠️ ceo_insights — 12日経過（未分析: 34件）→ 自動更新します
```

**自動更新の実行ルール:**
- `auto_update: true` かつ stale → 確認なしで実行（最大3件/セッション）
- `auto_update: false` → リマインドのみ
- 優先度順（priority 1→8）で実行
- `blocking: false` → ブリーフィング報告後にバックグラウンドで実行

**更新アクション（auto_update: true）:**

| priority | データ | 閾値 | 自動実行内容 |
|----------|--------|------|-------------|
| 1 | `ceo_insights` | 7日 or 未分析20件超 | prompt_log から行動パターン・好み・稼働リズムを分析→INSERT |
| 2 | `knowledge_base` | 14日 | Claude Memory の feedback 型を確認→未反映をINSERT。confidence≥3 は昇格提案 |
| 3 | `evaluations` | 30日 | 5軸評価を実行→レポート出力 |
| 6 | `preferences.yaml` | 30日 | スコア減衰を適用（デフォルト1.0へ10%回帰） |
| 7 | `intelligence` | 1日 | GitHub Actions障害の可能性→手動 collect.py 実行 |

**リマインドのみ（auto_update: false）:**

| priority | データ | 閾値 | リマインド内容 |
|----------|--------|------|---------------|
| 4 | `prep-log FB` | 3日 | 完了済みMTGの事後フィードバック入力を促す |
| 5 | `intelligence FB` | 7日 | 未レビューのレポートアイテムを提示 |
| 8 | `diary_analysis` | 30日 | 日記記録を促す |
