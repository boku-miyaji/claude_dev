# Claude Code アーキテクチャ再設計提案

> 2026-04-03 | 参考: everything-claude-code 設計思想 + 現行.company/運用実績

## 背景

everything-claude-code（Anthropicハッカソン優勝、90万view）の設計思想は「コンテキストを最適化する」こと。当プロジェクトの .company/ 仮想組織と本質的に同じ発想だが、以下の改善余地がある。

## 現状の課題

### 1. CLAUDE.md の肥大化
- HD の CLAUDE.md が200行超 → コンテキスト圧迫
- 「方針のみ」の原則が守られつつあるが、まだ手順的な記述が混在

### 2. エージェント（部署）のツール過多
- 部署エージェントに全ツールが渡されている
- 「50個のツールを持つエージェントより5個に絞った方が集中する」（記事）

### 3. MCP の同時有効化
- セッション開始時に多数のMCPが有効 → コンテキストが200k→70kに縮小する可能性
- プロファイル管理（mcp-profiles.yaml）は定義済みだが運用が不徹底

### 4. Hooks の活用不足
- prompt-log, config-sync は稼働中
- だが「ファイル編集後の自動フォーマット」「コミット前のリポジトリ判定」などは未実装

## 再設計方針

### 方針1: CLAUDE.md のさらなるスリム化

**現状**: 200行（方針 + 部署一覧 + 運営ルール + MCP管理 + パーソナライズ）
**目標**: 100行以下

| 残すもの | 移動先 |
|---------|--------|
| 設計思想（5原則） | 残す |
| アーキテクチャ図 | 残す（自動生成） |
| Agent一覧テーブル | 残す（自動生成） |
| ブリーフィング手順 | `references/` に既に分離済み ✓ |
| タスク管理ルール | `rules/task-management.md` に移動 |
| 意思決定永続化ルール | `rules/persistence.md` に移動 |
| 人事部評価ルール | `references/hr-evaluation.md` に移動 |
| MCP管理ルール | `rules/mcp-management.md` に移動 |
| パーソナライズメモ | Supabase `user_settings` に移動 |

### 方針2: エージェントのツール最小化

各部署エージェント（`.claude/agents/dept-*.md`）のfrontmatterに `allowed_tools` を明記:

```yaml
# dept-ai-dev.md
allowed_tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
```

```yaml
# dept-research.md（リサーチ部）
allowed_tools:
  - Read
  - WebFetch
  - WebSearch
  - Write
  - Grep
```

```yaml
# dept-materials.md（資料制作）
allowed_tools:
  - Read
  - Write
  - Bash  # PPTX生成に必要
  - Glob
```

### 方針3: MCP プロファイルの厳格運用

```yaml
# mcp-profiles.yaml の改善
profiles:
  minimal:  # 通常作業
    - supabase
    - playwright  # UIテスト時のみ
    
  calendar:  # /company 起動時
    - supabase
    - google-calendar
    
  research:  # リサーチ・情報収集時
    - supabase
    - context7
    
  full:  # 明示的に要求された時のみ
    - all
```

**運用ルール**: セッション開始時は `minimal` プロファイル。タスクに応じて秘書が切り替え。

### 方針4: Hooks の追加

| Hook | トリガー | 処理 |
|------|---------|------|
| `repo-guard.sh` | PreToolUse (Edit/Write) | 編集先のリポジトリが正しいか確認 |
| `format-on-save.sh` | PostToolUse (Edit/Write) | TS/TSXファイル編集後にprettier実行 |
| `commit-scope-check.sh` | PreToolUse (Bash: git commit) | コミット先リポジトリの検証 |
| `session-summary.sh` | Stop | セッション終了時にサマリーを自動生成 |

### 方針5: ルールの動的読み込み活用

`.claude/rules/` に状況依存ルールを追加:

```
.claude/rules/
├── commit-rules.md          # git操作時に自動読み込み（既存）
├── coding-style.md          # コーディング時（既存）
├── knowledge-accumulation.md # ナレッジ蓄積（既存）
├── task-management.md       # NEW: タスク操作時
├── persistence.md           # NEW: 意思決定・記録時
├── mcp-management.md        # NEW: MCP/プラグイン操作時
├── security.md              # NEW: セキュリティ関連操作時
└── dashboard.md             # NEW: company-dashboard 操作時
```

## 実施計画

| Phase | 内容 | 工数 |
|-------|------|------|
| 1 | CLAUDE.md スリム化（ルール分離） | 30分 |
| 2 | エージェントの allowed_tools 追加 | 15分 |
| 3 | MCP プロファイル厳格化 | 15分 |
| 4 | Hooks 追加（repo-guard, format-on-save） | 1時間 |
| 5 | 動的ルール追加 | 30分 |

## 判断が必要な点

1. **CLAUDE.md スリム化の範囲**: どこまで削るか
2. **Hooks**: format-on-save は便利だが、毎回走ると遅い可能性
3. **MCP プロファイル**: 自動切替 vs 手動切替
