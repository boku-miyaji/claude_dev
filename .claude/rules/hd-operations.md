# HD運営詳細ルール

## Hook と /company の責務分離

| 責務 | 実行者 | 特性 |
|------|--------|------|
| プロンプト記録 | Hook (UserPromptSubmit) | 軽量・非同期・失敗しても会話をブロックしない |
| ツール使用記録 | Hook (PostToolUse) | 同上 |
| settings/MCP 同期 | Hook (SessionStart) | 同上 |
| ブリーフィング | /company | コンテキスト依存・判断を伴う |
| ナレッジ適用 | /company | 同上 |
| タスク管理・組織運営 | /company | 同上 |
| Agent 委譲 | /company | 同上 |
| CEO分析・評価 | /company or バッチ | 蓄積トリガー or 手動 |
| intelligence 収集 | バッチ (GitHub Actions) | 定期実行 |

**原則**: Hook は「記録」、/company は「判断と行動」、バッチは「定期集計」

## タスク管理詳細

- 運用フロー: 依頼受付 → タスク作成（Supabase INSERT） → 作業実行 → 完了（status=done）
- タイトルにプレフィックス: `[security]`, `[dashboard]`, `[ops]` 等
- description に tags 記載: `tags: スコープ, 部署, カテゴリ, 技術`
- 分類体系: `.company/secretary/policies/task-classification.md` 参照
- 放置防止: 7日以上 open のタスクはブリーフィングでリマインド
- **作業完了時は必ず status=done + completed_at を更新**

## 意思決定の即時永続化

**重要な判断は会話内に留めず、即座に永続化する。** Context Compaction で消える前に書き込む。

| 種別 | 永続化先 |
|------|---------|
| 意思決定 | `secretary/notes/YYYY-MM-DD-decisions.md` + Supabase `activity_log` |
| 学び・気づき | `secretary/notes/YYYY-MM-DD-learnings.md` |
| アイデア | `secretary/inbox/YYYY-MM-DD.md` |
| ナレッジ（LLMデフォルトとの差分） | Supabase `knowledge_base` |
| チェックポイント判断 | 報告時に判断サマリを再掲 + ファイル記録 |

## 人事部（組織最適化エンジン）

**評価軸:**
| 評価軸 | 意味 | 低スコア時のアクション |
|--------|------|----------------------|
| 自律完遂率 | 追加指示なしで完了したか | CLAUDE.mdの手順を具体化 |
| 一発OK率 | やり直しの頻度 | テンプレート・品質基準を改善 |
| 連携効率 | 部署間の差し戻し率 | 連携プロトコルを改善 |
| 目標寄与度 | ゴールに直結するか | 方向性の再定義 |
| 稼働率 | 利用頻度 | 統合・廃止を提案 |

**自動トリガー:** 同じ修正指示2回→ルール改善提案 / 稼働なし3回→統合・廃止提案 / 差し戻し2回→連携改善提案

## MCP プロファイル管理

タスク開始時に `.company/mcp-profiles.yaml` を参照し、必要なプラグインのみを使用する。
全プラグイン同時使用はコンテキストウィンドウを圧迫するため避ける。

## ファイル管理
- 同日1ファイル: 同じ日付のファイルがある場合は追記
- 日付チェック: ファイル操作前に今日の日付を確認
- TODO形式: `- [ ] タスク | 優先度: 高/通常/低 | 期限: YYYY-MM-DD`
