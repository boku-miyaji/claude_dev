# ネクストアクション一括タスク化
## リサーチ部ハンドオフ対応（2026-04-06）

ステータス: 登録準備完了
タスク件数: 10件
対象ファイル: `/workspace/.company/departments/research/tech/claude-code-architecture-analysis.md`

---

## P0施策（4件）- 期限: 2026-04-13

### 1. [ops] settings.json の allow リストを共通/PJ固有に分離
- **ID**: TASK-001
- **優先度**: HIGH
- **担当**: システム開発部（sys-dev）
- **期限**: 2026-04-13
- **依存**: なし
- **説明**: 
  - 現状: 200行超の巨大なallow リストに PJ固有のパターンが混在している
  - 提案: settings.json（共通） + settings.local.json（PJ固有）に分離
  - ソース: https://code.claude.com/docs/en/how-claude-code-works
- **アクション内容**:
  1. 現在のsettings.jsonを共通パターンと PJ固有パターンに分類
  2. settings.local.json テンプレート作成
  3. git管理から settings.local.json を除外（.gitignore更新）
  4. permission-guard.sh で safe モード活用を確認
  5. ドキュメント更新（`.company/operations/settings-management.md` 等）
- **タグ**: ops, architecture, settings, permission-model, sys-dev

### 2. [ops] 各 Sub-agent の model/maxTurns/effort を最適化
- **ID**: TASK-002
- **優先度**: HIGH
- **担当**: 秘書（secretary）
- **期限**: 2026-04-13
- **依存**: なし
- **説明**:
  - 現状: 全Agent が model:sonnet, maxTurns:15 で画一的
  - 提案: リサーチ(opus,20)、AI開発(opus,20)、システム(sonnet,15)、PM(haiku,10)等で差別化
  - ソース: https://code.claude.com/docs/en/sub-agents
- **アクション内容**:
  1. 各部署Agent定義ファイル（`.claude/agents/dept-*.md`）の現状を把握
  2. 公式推奨値（表3.2参照）とのマッピング
  3. 社長と壁打ち（コスト vs 品質のトレードオフ）
  4. 承認後、各Agent定義ファイルを更新
  5. disallowedTools の活用（リサーチ部: read-only）
- **タグ**: ops, architecture, sub-agents, cost-optimization, secretary

### 3. [ops] Pre/PostCompact Hook の強化 + Compact Instructions 追加
- **ID**: TASK-003
- **優先度**: HIGH
- **担当**: システム開発部（sys-dev）
- **期限**: 2026-04-13
- **依存**: なし
- **説明**:
  - 現状: pre-compact-save.sh が最小限の内容のみ保存
  - 提案: CLAUDE.md に「Compact Instructions」セクション追加 + Hook強化
  - 重要発見: 公式ドキュメント「CLAUDE.md fully survives compaction」→ファイル内容は退避不要、動的状態のみ保存
  - ソース: https://code.claude.com/docs/en/memory
- **アクション内容**:
  1. `.company/CLAUDE.md` に「Compact Instructions」セクション追加
  2. 保持すべき情報を明示（パイプラインステップ、処理中タスクID等）
  3. pre-compact-save.sh を強化（動的状態の詳細な保存）
  4. PostToolUse で意思決定の即時永続化を判定するロジック検討
  5. 運用手順ドキュメント更新
- **タグ**: ops, architecture, compaction, context-management, sys-dev

### 4. [ops] Auto Memory の状態確認と独自ナレッジシステムとの役割分担決定
- **ID**: TASK-004
- **優先度**: HIGH
- **担当**: 秘書（secretary）
- **期限**: 2026-04-13（初期調査）
- **依存**: 社長壁打ち
- **説明**:
  - 現状: 公式 Auto Memory (MEMORY.md) と HD独自の knowledge/ + Supabase が並行稼働
  - 提案: SSOT（Single Source of Truth）を明確化する役割分担
    - Auto Memory: 自動蓄積
    - knowledge/: 昇格候補の管理台帳
    - Supabase: 分析・可視化用の二次ストア
  - ソース: https://code.claude.com/docs/en/memory
- **アクション内容**:
  1. 現在の Auto Memory の有効/無効状態を確認（`~/.claude/projects/<project>/memory/MEMORY.md`）
  2. 独自 knowledge/ の現在の内容（昇格候補）をスキャン
  3. Supabase knowledge_base テーブルの状態確認
  4. 社長と壁打ち（各ストアの役割、メンテナンスコストのバランス）
  5. 決定内容を `.company/operations/knowledge-system-architecture.md` に記録
- **タグ**: ops, architecture, memory, knowledge-base, secretary

---

## P1施策（3件）- 期限: 未定（依存関係に基づいて調整）

### 5. [ops] SubagentStart/Stop Hook の設計・実装
- **ID**: TASK-005
- **優先度**: NORMAL
- **担当**: システム開発部（sys-dev）
- **期限**: なし（TASK-002完了後）
- **依存**: TASK-002（Sub-agent最適化完了後）
- **説明**:
  - 現状: 23+の公式イベントのうち8つのみ使用、SubagentStart/Stop は未使用
  - 提案: SubagentStart で起動ログ + コンテキスト注入、SubagentStop で成果物自動検証 + ハンドオフ検出
  - 期待効果: 委譲の可観測性向上、手動検証の自動化
  - ソース: https://code.claude.com/docs/en/hooks
- **アクション内容**:
  1. `.claude/hooks/` に SubagentStart.sh / SubagentStop.sh を追加
  2. SubagentStart: 部署Agent起動時のログ記録 + コンテキスト注入ロジック
  3. SubagentStop: 成果物検証（ファイルサイズ、必須セクション確認）+ ハンドオフ検出
  4. テスト: 各部署Agent 1回ずつ実行確認
  5. ドキュメント更新（Hook仕様書）
- **タグ**: ops, architecture, hooks, sub-agents, automation, sys-dev

### 6. [ops] @import の導入（委譲テンプレート等）
- **ID**: TASK-006
- **優先度**: NORMAL
- **担当**: 秘書（secretary）
- **期限**: なし
- **依存**: なし
- **説明**:
  - 現状: `.company/references/` のドキュメントを手動 Read している
  - 提案: CLAUDE.md に `@import` を使って参照ドキュメント（委譲テンプレート、ブリーフィング手順）を自動ロード
  - ソース: https://code.claude.com/docs/en/memory
- **アクション内容**:
  1. `.company/references/` 内のドキュメントを確認
  2. どれを @import すべきか優先順位付け（コンテキスト増加とのバランス）
  3. `.company/CLAUDE.md` に `@references/agent-delegation-template.md` 等を追加
  4. 各部署Agent定義に `@.company/departments/{dept}/CLAUDE.md` を frontmatter で記述検討
  5. テスト: 新規委譲時にテンプレートが自動ロードされるか確認
- **タグ**: ops, architecture, memory, documentation, secretary

### 7. [ops] HTTP Hook への Supabase 書き込み移行検討
- **ID**: TASK-007
- **優先度**: NORMAL
- **担当**: システム開発部（sys-dev）
- **期限**: なし
- **依存**: なし
- **説明**:
  - 現状: 複数スクリプトで独自に curl でSupabaseに書き込み、認証情報ロード重複
  - 提案: HTTP hook に移行（type: "http" + url + headers + allowedEnvVars）
  - トレードオフ: JSON ペイロードの柔軟性が低い→タグ付けロジック等は shell 残す可能性
  - ソース: https://code.claude.com/docs/en/hooks
- **アクション内容**:
  1. 現在のShellスクリプト（prompt-log.sh, config-sync.sh, session-summary.sh等）を列挙
  2. 各スクリプトの Supabase 書き込みロジックを分析
  3. HTTP hook への移行が適切なものを選定
  4. HTTP hook の設定ファイル作成（`.claude/hooks.json` 等）
  5. 移行対象スクリプトのシンプル化
  6. テスト + ドキュメント更新
- **タグ**: ops, architecture, hooks, supabase, sys-dev

---

## P2施策（3件）- 期限: 未定（将来的な最適化）

### 8. [ops] path-specific rules の導入
- **ID**: TASK-008
- **優先度**: LOW
- **担当**: 秘書（secretary）
- **期限**: なし
- **依存**: なし
- **説明**:
  - 提案: `.claude/rules/` ファイルに `paths` frontmatter を追加し、関連ファイル操作時のみロード
  - 効果: コンテキストウィンドウ節約（現在6ファイル常時ロード→必要時のみロード）
- **アクション内容**:
  1. `.claude/rules/` 各ファイルを確認
  2. 各ルールが適用される paths パターンを定義
  3. frontmatter に `paths` 追加（例: commit-rules は `**/.git/**`, `**/package.json`）
  4. テスト: git操作時に commit-rules がロードされるか確認
  5. ドキュメント更新
- **タグ**: ops, architecture, rules, context-optimization, secretary

### 9. [ops] Explore 相当の軽量 Agent 追加
- **ID**: TASK-009
- **優先度**: LOW
- **担当**: 秘書（secretary）
- **期限**: なし
- **依存**: TASK-002（Sub-agent最適化完了後推奨）
- **説明**:
  - 提案: コードベース探索専用の Agent を新規追加（tools: Read/Glob/Grep, model: haiku）
  - 効果: 「構造把握」フェーズを軽量に実行可能
- **アクション内容**:
  1. 既存Agent定義（`.claude/agents/dept-*.md`）のテンプレートを確認
  2. Explorer Agent定義ファイル作成（`.claude/agents/explorer.md`）
  3. 必要なツール、model, maxTurns, effort を設定
  4. テスト: 実際のコードベース探索タスクで実行
  5. ドキュメント更新（Agent一覧、委譲テンプレート）
- **タグ**: ops, architecture, agents, exploration, secretary

### 10. [research] Agent Teams 機能の調査
- **ID**: TASK-010
- **優先度**: LOW
- **担当**: リサーチ部（research）
- **期限**: なし
- **依存**: なし
- **説明**:
  - 提案: Claude Code 2026年新機能「Agent Teams」（複数Agent が独立セッションで並行稼働・相互通信）の詳細調査
  - 目的: HD パイプライン（A-E）をAgent Teams で実装した場合のアーキテクチャを検証
  - コンテキスト: Agent Teams導入→秘書のパイプライン管理負荷削減の可能性
- **アクション内容**:
  1. 公式ドキュメント詳読（https://code.claude.com/docs/en/）
  2. Agent Teams の具体的な機能・制限を把握
  3. 現在のHDパイプライン（A-E）とAgent Teams の比較
  4. 実装コスト・効果の検証（委譲テンプレート vs Agent Teams）
  5. リサーチ報告書作成（「Agent Teams 導入検討書」）
  6. 秘書/社長への推奨判断
- **タグ**: research, ops, architecture, agent-teams, investigation

---

## 登録方法

### オプション1: SQLダイレクト実行（Supabase管理画面）
```bash
# SQL エディタで以下を実行
cat /workspace/.company/departments/pm/scripts/insert-nextactions-2026-04-06.sql
```

Supabase Project: akycymnahqypmtsfqhtr

### オプション2: API経由（Supabase REST API）
```bash
# 各タスクを INSERT
curl -X POST 'https://akycymnahqypmtsfqhtr.supabase.co/rest/v1/tasks' \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"company_id":"hd","title":"[ops] ...","description":"...","priority":"high",...}'
```

### オプション3: execute_sql ツール（Claude Code内）
Supabaseプラグインまたはカスタムツール経由で実行。

---

## ステータス

| タスク | ID | 状態 | 
|--------|-----|------|
| 1. settings.json分離 | TASK-001 | 📋 登録準備完了 |
| 2. Sub-agent最適化 | TASK-002 | 📋 登録準備完了 |
| 3. Pre/PostCompact強化 | TASK-003 | 📋 登録準備完了 |
| 4. AutoMemory統合 | TASK-004 | 📋 登録準備完了 |
| 5. SubagentStart/Stop | TASK-005 | 📋 登録準備完了 |
| 6. @import導入 | TASK-006 | 📋 登録準備完了 |
| 7. HTTPHook移行 | TASK-007 | 📋 登録準備完了 |
| 8. path-specific rules | TASK-008 | 📋 登録準備完了 |
| 9. Explorer Agent追加 | TASK-009 | 📋 登録準備完了 |
| 10. Agent Teams調査 | TASK-010 | 📋 登録準備完了 |

---

## 注記

- **P0施策** : 1週間以内（2026-04-13）完了を推奨
- **P1施策** : 依存関係に基づいて実行順序を決定（TASK-002 待ちのタスク有）
- **P2施策** : 将来的な最適化。実装時期はコンテキストウィンドウ圧迫状況に応じて判断
- **ハンドオフ完了**: リサーチ部より PM部への委譲完了、各部署への詳細アクション指示は次段階で秘書が行う

---

## 参考

- 分析書: `/workspace/.company/departments/research/tech/claude-code-architecture-analysis.md`
- SQL: `/workspace/.company/departments/pm/scripts/insert-nextactions-2026-04-06.sql`
- 秘書向けアクション詳細: 上記10項目の「アクション内容」を参照

