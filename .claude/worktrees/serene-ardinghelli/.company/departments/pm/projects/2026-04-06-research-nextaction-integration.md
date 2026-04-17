# プロジェクト: リサーチ部ハンドオフ対応 - ネクストアクション統合

## プロジェクト基本情報

- **PJ名**: 研究成果のタスク化・優先度付け
- **作成日**: 2026-04-06
- **PM**: PM部
- **ステータス**: planning → in-progress
- **成果物**: タスク登録（10件）、ドキュメント化

## ゴール

Claude Code公式アーキテクチャとHD設計の差分分析書（リサーチ部完成）のネクストアクション10項目を、以下の形式でタスク化する:
1. **タスク化**: Supabaseの `tasks` テーブルに INSERT
2. **優先度付け**: P0(高)/P1(中)/P2(低)で分類
3. **期限設定**: P0施策は「1週間以内（2026-04-13）」
4. **依存関係管理**: 各タスク間の前提条件を記録
5. **部署割り当て**: 担当部署を明示

## スコープ

### 入力
- `/workspace/.company/departments/research/tech/claude-code-architecture-analysis.md`
  - Section 6: ネクストアクション（10項目、表形式）
  - Sections 3.1-3.10: 各アクションの詳細説明

### 出力
1. **SQL スクリプト**: `/workspace/.company/departments/pm/scripts/insert-nextactions-2026-04-06.sql`
   - 10件の INSERT ステートメント
   - Supabase Project: akycymnahqypmtsfqhtr
   
2. **チケット整理書**: `/workspace/.company/departments/pm/tickets/2026-04-06-nextaction-batch.md`
   - P0/P1/P2の分類
   - 各タスクの詳細な「アクション内容」
   - 依存関係マッピング
   
3. **プロジェクト進捗ファイル**: このファイル

## マイルストーン

| # | マイルストーン | 期限 | ステータス |
|----|-------------|------|----------|
| M1 | 分析書読み込み + タスク化方針決定 | 2026-04-06 | ✅ 完了 |
| M2 | SQL スクリプト作成 | 2026-04-06 | ✅ 完了 |
| M3 | チケット整理書作成 | 2026-04-06 | ✅ 完了 |
| M4 | タスク登録（Supabase INSERT）| 2026-04-06 | ⏳ 保留（秘書確認待ち） |
| M5 | 各部署への詳細アクション指示 | 2026-04-07 | 予定 |
| M6 | P0施策着手 | 2026-04-06 | 予定 |

## 実装詳細

### M1: 分析書読み込み＆方針決定
**完了内容**:
- 分析書の Section 6 を読み込み
- ネクストアクション10項目を以下のように分類
  - P0（高優先度）: 4件 → 期限 2026-04-13
  - P1（中優先度）: 3件 → 依存関係に基づいて調整
  - P2（低優先度）: 3件 → 将来的な最適化

### M2: SQL スクリプト作成
**成果物**: `/workspace/.company/departments/pm/scripts/insert-nextactions-2026-04-06.sql`

各タスクに以下の情報を含める:
- `company_id`: 'hd'（全社共通アクション）
- `title`: `[ops]` / `[research]` プレフィックス付き
- `description`: ネクストアクション説明 + ソース + 依存関係
- `priority`: 'high' (P0) / 'normal' (P1) / 'low' (P2)
- `assigned_to`: 担当部署
- `due_date`: P0のみ 2026-04-13
- `tags`: ops, architecture, {domain}, {dept}

### M3: チケット整理書作成
**成果物**: `/workspace/.company/departments/pm/tickets/2026-04-06-nextaction-batch.md`

各タスクの「アクション内容」を詳細に展開:
- 背景・現状課題
- 提案内容
- 実装手順（具体的な step-by-step）
- 依存タスク
- 成果物イメージ

### M4: タスク登録（Supabase INSERT）
**実行方法**:

**オプション1**: Supabase管理画面でSQLエディタを開き、SQLスクリプトを実行
```bash
# SQLスクリプトのパス
/workspace/.company/departments/pm/scripts/insert-nextactions-2026-04-06.sql
```

**オプション2**: Supabase REST API で各タスクを POST
```bash
curl -X POST 'https://akycymnahqypmtsfqhtr.supabase.co/rest/v1/tasks' \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

**オプション3**: Claude Code 内の execute_sql ツール経由

**状態**: ⏳ 保留
- 秘書（社長）が確認後、登録実行を許可
- タスク登録後、各部署へ詳細指示

### M5: 各部署への詳細アクション指示
**実行者**: 秘書
**方法**: Agent ツールで各部署へ委譲

```
→ システム開発部: TASK-001, 003, 005, 007
→ 秘書: TASK-002, 004, 006, 008, 009
→ リサーチ部: TASK-010
```

**チェックリスト**:
- [ ] 各タスクの「アクション内容」を部署に渡す
- [ ] 依存関係を明確化（TASK-005は TASK-002待ち等）
- [ ] リソース割り当て確認（複数タスク並列実行可否）

### M6: P0施策着手
**期限**: 2026-04-13

着手順序（依存関係なし、並列可能）:
1. TASK-001: settings.json分離 (sys-dev)
2. TASK-002: Sub-agent最適化 (secretary)
3. TASK-003: Pre/PostCompact強化 (sys-dev)
4. TASK-004: AutoMemory統合 (secretary)

**成果物イメージ**:
- TASK-001: `settings.local.json` テンプレート + `.gitignore` 更新 + docs
- TASK-002: 各Agent定義ファイル更新 + 決定サマリ
- TASK-003: `.company/CLAUDE.md` 更新 + Hook強化 + docs
- TASK-004: 決定ドキュメント（knowledge-system-architecture.md）

## 依存関係グラフ

```
TASK-001 (settings分離) → [独立]
TASK-002 (Sub-agent最適化) → TASK-005, TASK-009
TASK-003 (Compaction強化) → [独立]
TASK-004 (AutoMemory) → [社長壁打ち]
TASK-005 (SubagentStart/Stop) → [TASK-002待ち]
TASK-006 (@import) → [独立]
TASK-007 (HTTPHook) → [独立]
TASK-008 (path-specific) → [独立]
TASK-009 (Explorer) → [TASK-002待ち]
TASK-010 (Agent Teams調査) → [独立]
```

**クリティカルパス**: TASK-002 → TASK-005, TASK-009

## リスク＆対応

| リスク | 影響 | 対応 |
|--------|------|------|
| Supabase接続エラー | タスク登録失敗 | SQL実行前に接続確認（`supabase-status.sh`） |
| TASK-002の社長判断遅延 | TASK-005, TASK-009がブロック | TASK-002を独立した準備タスクに分割 |
| P0施策の過度な並列実行 | リソース不足 | 秘書が実装順序を調整 |
| ドキュメント散在 | 情報検索効率低下 | 統合ドキュメント（operations/architecture.md等）を作成 |

## 統計

- **総タスク数**: 10件
- **P0（高）**: 4件（期限: 2026-04-13）
- **P1（中）**: 3件（依存: 最大2件）
- **P2（低）**: 3件（将来実装）
- **担当部署数**: 3部署
  - システム開発部: 4件
  - 秘書: 5件
  - リサーチ部: 1件

## 次ステップ（秘書向け）

1. **確認**: このドキュメント + チケット整理書を読む
2. **判断**: SQLスクリプトの実行を承認
3. **登録**: オプション1-3いずれかの方法でタスク登録
4. **委譲**: 各部署Agent へ委譲（Agent ツール）
5. **追跡**: Supabase `tasks` テーブルで進捗確認

---

## 関連ドキュメント

- **分析書**: `/workspace/.company/departments/research/tech/claude-code-architecture-analysis.md`
- **SQL**: `/workspace/.company/departments/pm/scripts/insert-nextactions-2026-04-06.sql`
- **チケット整理**: `/workspace/.company/departments/pm/tickets/2026-04-06-nextaction-batch.md`
- **Supabase**: https://akycymnahqypmtsfqhtr.supabase.co

---

## ステータス更新履歴

| 日時 | イベント | 詳細 |
|------|---------|------|
| 2026-04-06 | プロジェクト開始 | リサーチ部ハンドオフ受け取り → タスク化開始 |
| 2026-04-06 | M1-M3 完了 | 分析書読み込み → SQL作成 → チケット整理 |
| 2026-04-06 | M4 保留中 | 秘書確認待ち |

