# 設計: Claude Code 内部構造を踏まえたHD運用改善

**日付**: 2026-04-02
**起因**: コメント#3（ダッシュボード経由）
**ステータス**: implemented

## 背景

Claude Code の agentic loop / context loading / tool execution model を正しく理解し、HD の CLAUDE.md 設計・Hook 設計・Agent 委譲を最適化する。

## Claude Code 内部構造の要点

| 仕組み | 内容 | HD設計への示唆 |
|--------|------|---------------|
| **Agentic Loop** | Request→Reason→Tool→Result→Loop | 1ターンで複数ツール呼び出し可能。パイプラインの各ステップをツール呼び出し単位で設計すべき |
| **Context Loading** | system prompt（git status, CLAUDE.md, tools list）は会話開始時にメモ化 | CLAUDE.md は起動時に1回読まれる。途中で更新しても反映されない。**起動時に必要な情報をすべて含める** |
| **Context Compaction** | 長い会話は古いメッセージが要約される | 重要な判断・ルールは CLAUDE.md に書くべき（会話内で伝えても圧縮で消える） |
| **Tool Permission** | allow/ask/deny の3段階 | Hook の自動実行は allow されるツールのみ。重い処理は ask になりうる |
| **Sub-agents (Task tool)** | 独立した会話・制限されたツールセット | Agent 委譲時に **全コンテキストを渡す必要がある**（親の会話は見えない） |
| **maxResultSizeChars** | 大きな結果はtempファイル化 | Supabase の大量レスポンスは truncate される。クエリで絞り込む |
| **Conversation Storage** | JSON でディスク保存、--resume で再開可 | セッション跨ぎの情報は Supabase / ファイルに永続化必須 |

## 改善設計

### 1. CLAUDE.md のスリム化（Context Loading 対応）

**現状の問題**: HD の CLAUDE.md が 380行超。起動時にすべてがコンテキストに載る。

**改善**:
- CLAUDE.md は **判断ルール・方針** のみに絞る（〜150行目標）
- 手順の詳細（curl コマンド、SQL例等）は **参照ファイル** に分離
- `references/` ディレクトリに移動し、必要時に Read で取得

```
CLAUDE.md（150行）
  ├── 基本方針・口調・判断基準
  ├── 部署一覧（テーブル）
  └── 「詳細は references/ を参照」のポインタ

references/
  ├── briefing-procedure.md      ← ブリーフィング手順
  ├── supabase-queries.md        ← curl/SQLテンプレート
  ├── freshness-policy.md        ← 鮮度チェック詳細
  └── pipeline-specs.md          ← パイプライン仕様
```

### 2. Agent 委譲のコンテキスト設計（Sub-agent 対応）

**現状の問題**: Agent に渡すプロンプトが不十分で、PJコンテキストが欠落することがある。

**改善**: Agent 委譲テンプレートの標準化

```markdown
## Agent 委譲プロンプト標準形式

### 必須コンテキスト（毎回渡す）
1. PJ会社名 + CLAUDE.md の要約（3行以内）
2. 紐づきリポジトリのパス
3. 今回のタスク内容
4. 前ステップの成果物（パス or 内容要約）
5. 適用すべき knowledge_base ルール（active & 該当スコープ）

### 渡してはいけないもの
- HD全体の組織図（不要なコンテキスト消費）
- 他PJ会社の情報（コンテキスト汚染）
- 手順の詳細（Agent 自身の CLAUDE.md に書くべき）
```

### 3. コンテキスト圧縮対策（Compaction 対応）

**現状の問題**: 長いセッションで重要な判断が圧縮される。

**改善**:
- 重要な意思決定は **即座に Supabase + ファイルに永続化**（会話内に残さない）
- チェックポイント報告時に「ここまでの判断サマリ」を明示的に再掲
- 長いパイプライン実行時は Agent 委譲で会話を分離（親のコンテキストを消費しない）

### 4. ブリーフィングの並列実行（Agentic Loop 対応）

**現状の問題**: カレンダー取得→コメント取得→タスク取得→鮮度チェックが逐次実行。

**改善**: 独立したデータ取得は並列で実行

```
[並列実行]
  ├── カレンダー取得（Google Calendar MCP）
  ├── コメント取得（Supabase curl）
  ├── タスク取得（Supabase curl）
  └── 鮮度チェック（freshness-check.sh）

[統合] → ブリーフィング表示
```

### 5. Hook と /company の責務明確化（Tool Execution Model 対応）

**現状**: Hook でやること / /company でやることの境界が曖昧。

**改善原則**:
- **Hook** = 軽量・非同期・失敗しても会話をブロックしない処理
  - prompt_log 記録、tool_collector、config-sync
- **/company** = コンテキスト依存・判断を伴う処理
  - ブリーフィング、ナレッジ適用、タスク管理、Agent 委譲
- **どちらでもない** = バッチ処理（cron / GitHub Actions）
  - ceo_insights 分析、evaluations 生成、intelligence 収集

## 実装優先順位

| 優先度 | 改善 | 効果 | 工数 |
|--------|------|------|------|
| 1 | CLAUDE.md スリム化 | コンテキスト効率 大幅改善 | 中 |
| 2 | Agent 委譲テンプレート標準化 | 委譲品質向上 | 小 |
| 3 | ブリーフィング並列化 | 起動速度向上 | 小 |
| 4 | 意思決定の即時永続化 | 情報損失防止 | 小 |
| 5 | Hook/company 責務分離 | 保守性向上 | 中 |

## 次のステップへの申し送り

- 本設計の承認後、優先度1（CLAUDE.md スリム化）から実装開始
- スリム化では既存ルールを削除しない（references/ への移動のみ）
- 移動後に /company の動作テストを実施し、情報欠落がないか検証
