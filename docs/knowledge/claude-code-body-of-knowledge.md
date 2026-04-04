# Claude Code 体系知識

> 調査日: 2026-04-04
> 調査部署: リサーチ部 技術調査チーム
> ステータス: completed

---

## 1. アーキテクチャと内部動作

### 1.1 Agentic Loop（エージェントループ）

Claude Codeの中核は `while(tool_call)` ループ。DAG、分類器、RAGは一切使わず、**モデル自身が全ての判断を下す**。

3つのフェーズが融合して動作する:

1. **Gather Context** -- ファイル読み込み、コード検索
2. **Take Action** -- 編集、コマンド実行
3. **Verify Results** -- テスト実行、出力確認

各ツール使用の結果が次のステップの判断に使われる。ユーザーはいつでも割り込んで方向修正が可能。

> **出典**: [How Claude Code works - Claude Code Docs](https://code.claude.com/docs/en/how-claude-code-works)

### 1.2 ツール体系

Claude Codeは「Agentic Harness（エージェントハーネス）」としてモデルにツール、コンテキスト管理、実行環境を提供する。

| カテゴリ | ツール | 用途 |
|---------|-------|------|
| ファイル操作 | Read, Write, Edit | ファイルの読み書き・編集 |
| 検索 | Glob, Grep | パターンマッチ、正規表現検索 |
| 実行 | Bash | シェルコマンド、ビルド、テスト、git |
| Web | WebSearch, WebFetch | Web検索、ページ取得 |
| コード知性 | Code Intelligence Plugins | 型エラー、定義ジャンプ、参照検索 |
| 委譲 | Agent (subagent), Task | サブエージェント起動、タスク管理 |
| 質問 | AskUserQuestion | ユーザーへの確認 |

> **出典**: [How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works), [Tools Reference](https://code.claude.com/docs/en/tools-reference)

### 1.3 Context Loading（コンテキストローディング）

セッション開始時に以下の順序でコンテキストが構築される:

1. **System Prompt** -- Claude Codeの基本指示
2. **CLAUDE.md** -- プロジェクトルートから上方向に走査、全階層を結合
3. **CLAUDE.local.md** -- 各階層でCLAUDE.mdの後に追加
4. **Auto Memory** -- `MEMORY.md` の先頭200行 or 25KB
5. **Rules** -- `.claude/rules/` の無条件ルール
6. **Skills Description** -- スキルの説明文のみ（本文はオンデマンド）
7. **MCP Tool Names** -- ツール名のみ（スキーマはオンデマンド、Tool Search）

**重要**: CLAUDE.mdはユーザーメッセージとして注入される（システムプロンプトの一部ではない）。そのため完全な遵守は保証されない。

> **出典**: [How Claude remembers your project](https://code.claude.com/docs/en/memory), [Best Practices](https://code.claude.com/docs/en/best-practices)

### 1.4 Context Compaction（コンテキスト圧縮）

コンテキストウィンドウが閾値に達すると自動発動する:

- **トリガー**: 設定した閾値（推奨: 75%）を超過時
- **処理**: 古いツール出力をクリア → 会話を要約 → 圧縮ブロック生成
- **保持されるもの**: コードパターン、ファイル状態、重要な判断
- **失われる可能性**: 会話初期の詳細な指示

**CLAUDE.mdは圧縮後も完全に生存する**。`/compact` 後、ディスクから再読み込みされてセッションに再注入される。会話中のみの指示は圧縮で失われるため、永続化が必要な指示はCLAUDE.mdに書くべき。

コンテキスト使用率の目安:

| 使用率 | 状態 | 推奨アクション |
|--------|------|--------------|
| 0-50% | 自由に作業可能 | そのまま |
| 50-70% | 注意 | 不要な文脈があれば `/clear` |
| 70-90% | `/compact` 推奨 | `/compact` でフォーカスを指定 |
| 90%+ | `/clear` 必須 | セッションをリセット |

> **出典**: [Compaction - Claude API Docs](https://platform.claude.com/docs/en/build-with-claude/compaction), [Best Practices](https://code.claude.com/docs/en/best-practices), [MindStudio Guide](https://www.mindstudio.ai/blog/claude-code-compact-command-context-management)

### 1.5 モデル選択

| モデル | 特徴 | 用途 |
|--------|------|------|
| Sonnet | バランス型 | 一般的なコーディングタスク |
| Opus | 高い推論力 | 複雑なアーキテクチャ判断 |
| Haiku | 高速・低コスト | Exploreサブエージェント、軽量タスク |

セッション中に `/model` で切替可能。

> **出典**: [How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works)

---

## 2. CLAUDE.md 設計パターン

### 2.1 効果的な構造

**目標: 200行以内/ファイル**。各行について「この行を削除したらClaudeがミスするか？」を問う。

```markdown
# Code style
- Use ES modules (import/export) syntax, not CommonJS (require)
- Destructure imports when possible

# Workflow
- Be sure to typecheck when you're done making a series of code changes
- Prefer running single tests, not the whole test suite, for performance
```

#### 含めるべきもの

| 項目 | 例 |
|------|---|
| Claudeが推測できないBashコマンド | `npm run test`, `make build` |
| デフォルトと異なるコードスタイル | "Use ES modules, not CommonJS" |
| テスト指示・テストランナー | "Use vitest, not jest" |
| リポジトリ作法 | ブランチ命名、PR規約 |
| PJ固有のアーキテクチャ判断 | "State management uses Zustand" |
| 環境固有の注意事項 | 必須の環境変数 |
| よくあるハマりポイント | 非自明な挙動 |

#### 含めてはいけないもの

| 項目 | 理由 |
|------|------|
| コードを読めばわかること | 冗長 |
| 言語の標準規約 | Claudeは既知 |
| 詳細なAPIドキュメント | リンクで十分 |
| 頻繁に変わる情報 | メンテコスト |
| ファイルごとの説明 | コード自体が説明 |
| "Write clean code" のような自明な指示 | 効果なし |

### 2.2 階層構造と配置

| スコープ | 配置場所 | 用途 |
|---------|---------|------|
| 組織全体 | `/Library/Application Support/ClaudeCode/CLAUDE.md` (macOS) | 全社コーディング標準 |
| プロジェクト | `./CLAUDE.md` or `./.claude/CLAUDE.md` | チーム共有の規約 |
| ユーザー個人 | `~/.claude/CLAUDE.md` | 個人の好み（全PJ） |
| ローカル | `./CLAUDE.local.md` | 個人のPJ固有設定 |

子ディレクトリのCLAUDE.mdはオンデマンドでロードされる（そのディレクトリのファイルを触った時）。

### 2.3 インポート構文

```markdown
See @README.md for project overview and @package.json for available npm commands.
- Git workflow: @docs/git-instructions.md
- Personal overrides: @~/.claude/my-project-instructions.md
```

相対パスはインポート元ファイルからの相対。最大5段ネスト。HTMLブロックコメント `<!-- -->` はコンテキスト注入前に除去される。

### 2.4 `.claude/rules/` による分割

```
.claude/rules/
  code-style.md      # コードスタイル
  testing.md          # テスト規約
  security.md         # セキュリティ要件
  frontend/           # サブディレクトリOK
    react-patterns.md
```

#### パス固有ルール

```markdown
---
paths:
  - "src/api/**/*.ts"
---
# API Development Rules
- All API endpoints must include input validation
```

`paths` なしのルールは無条件ロード。`paths` ありのルールはマッチするファイルを触った時のみロード。

### 2.5 強調テクニック

重要なルールには "IMPORTANT" や "YOU MUST" を付けると遵守率が上がる。ただし多用すると効果が薄れる。

### 2.6 パフォーマンスとの関係

- CLAUDE.mdが長すぎると、重要なルールがノイズに埋もれて無視される
- Claudeが既にCLAUDE.mdの指示に反する場合、ファイルが長すぎてルールが見落とされている可能性が高い
- Claudeが答えを知っているはずの質問をしてくる場合、表現が曖昧な可能性がある

> **出典**: [CLAUDE.md - Claude Code Docs](https://code.claude.com/docs/en/memory), [Best Practices](https://code.claude.com/docs/en/best-practices), [CLAUDE.md Best Practices - UX Planet](https://uxplanet.org/claude-md-best-practices-1ef4f861ce7c?gi=77cc11fce3f9)

---

## 3. メモリとナレッジの設計

### 3.1 二つのメモリシステム

| | CLAUDE.md | Auto Memory |
|---|---|---|
| 誰が書く | ユーザー | Claude |
| 内容 | 指示・ルール | 学習・パターン |
| スコープ | PJ/ユーザー/組織 | ワークツリー単位 |
| ロード | 毎セッション全文 | 毎セッション先頭200行 or 25KB |
| 用途 | コーディング標準、ワークフロー | ビルドコマンド、デバッグ知見、好み |

### 3.2 Auto Memory の仕組み

- **保存先**: `~/.claude/projects/<project>/memory/`
- **エントリーポイント**: `MEMORY.md`（インデックス）
- **トピックファイル**: `debugging.md`, `api-conventions.md` など
- `MEMORY.md` はセッション開始時にロードされる（先頭200行 or 25KB）
- トピックファイルはオンデマンドで読まれる
- 同一gitリポジトリの全ワークツリーが同一メモリディレクトリを共有

### 3.3 サブエージェントのメモリ

サブエージェントも独自のAuto Memoryを持てる:

```yaml
---
name: code-reviewer
memory: user  # user or project スコープ
---
```

- `user` スコープ: `~/.claude/agent-memory/` に保存
- `project` スコープ: プロジェクト内に保存

### 3.4 効果的なメモリ設計パターン

1. **CLAUDE.mdは方針のみ**: 手順詳細は別ファイルに分離し、必要時に `@` で参照
2. **意思決定は即時永続化**: Context Compactionで消える前にファイルまたはDBに書き込む
3. **Auto Memoryは監査可能**: `/memory` でブラウズ、プレーンMarkdownなので手動編集・削除可能
4. **Compaction Instructions**: CLAUDE.mdに「圧縮時に保持すべき情報」を明記

```markdown
# Compact Instructions
When compacting, always preserve:
- The full list of modified files
- Any test commands that were run
- Current implementation status
```

### 3.5 限界

- Auto Memoryはマシンローカル。クラウド環境やチーム間で共有されない
- `MEMORY.md` の200行制限を超えた情報はセッション開始時にロードされない
- 会話中の指示は圧縮で失われる可能性がある

> **出典**: [How Claude remembers your project](https://code.claude.com/docs/en/memory), [Context Engineering Cookbook](https://platform.claude.com/cookbook/tool-use-context-engineering-context-engineering-tools)

---

## 4. Hooks 活用パターン

### 4.1 基本原則

**Hooks は100%決定的。** CLAUDE.mdの指示はアドバイス（遵守されない可能性がある）だが、Hooksは毎回必ず実行される。

- フォーマッティング、リンティング、セキュリティチェックなど「例外なく毎回実行すべきこと」はHookに
- 「Claudeが考慮すべきガイダンス」はCLAUDE.mdに

### 4.2 Hook タイプ

| タイプ | 説明 | 用途 |
|--------|------|------|
| `command` | シェルコマンド実行 | lint, format, セキュリティスキャン |
| `http` | HTTPエンドポイントにPOST | 外部サービス連携 |
| `prompt` | Claudeに単発Yes/No評価 | コマンド安全性チェック |
| `agent` | サブエージェント起動 | 複雑な検証 |

### 4.3 主要ライフサイクルイベント

| イベント | タイミング | 主な用途 |
|---------|----------|---------|
| **SessionStart** | セッション開始・再開 | 環境変数設定、コンテキスト追加 |
| **SessionEnd** | セッション終了 | ログ記録、クリーンアップ |
| **UserPromptSubmit** | ユーザー入力処理前 | プロンプト検証、コンテキスト付加 |
| **PreToolUse** | ツール実行前 | ブロック（allow/deny/ask/defer）、入力変更 |
| **PostToolUse** | ツール実行成功後 | lint、フィードバック |
| **PostToolUseFailure** | ツール実行失敗後 | エラーコンテキスト提供 |
| **PermissionRequest** | 許可ダイアログ表示時 | 自動承認/拒否 |
| **PreCompact/PostCompact** | 圧縮前後 | コンテキスト保全、ログ |
| **SubagentStart/Stop** | サブエージェント開始/終了 | コンテキスト注入、結果後処理 |
| **FileChanged** | 監視ファイル変更時 | 環境リロード |
| **InstructionsLoaded** | CLAUDE.md/rules読込時 | デバッグ、ログ |
| **Stop** | Claude応答完了時 | 後処理 |

### 4.4 実践パターン

#### 破壊的コマンドのブロック

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash",
      "hooks": [{
        "type": "command",
        "if": "Bash(rm *)",
        "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/block-rm.sh"
      }]
    }]
  }
}
```

#### 編集後の自動Lint

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Edit|Write",
      "hooks": [{
        "type": "command",
        "command": "/path/to/lint-check.sh",
        "timeout": 30
      }]
    }]
  }
}
```

#### セッション開始時のコンテキスト注入

```json
{
  "hooks": {
    "SessionStart": [{
      "matcher": "startup",
      "hooks": [{
        "type": "command",
        "command": "cat project-status.md"
      }]
    }]
  }
}
```

### 4.5 Exit Code の意味

| Exit Code | 意味 | 動作 |
|-----------|------|------|
| 0 | 成功 | JSONをパース。stdoutがコンテキストに |
| 2 | ブロッキングエラー | ツール呼び出し拒否、プロンプト拒否等 |
| その他 | 非ブロッキングエラー | stderrをverboseモードに表示、実行継続 |

### 4.6 パフォーマンス考慮事項

- デフォルトタイムアウト: command=600秒, prompt=30秒, agent=60秒
- `async: true` でバックグラウンド実行可能
- Hookの出力は10,000文字でキャップされる
- シェルプロファイルがテキストを出力するとJSON解析が壊れる

> **出典**: [Hooks Reference - Claude Code Docs](https://code.claude.com/docs/en/hooks), [Claude Code Hooks Guide 2026](https://serenitiesai.com/articles/claude-code-hooks-guide-2026)

---

## 5. MCP (Model Context Protocol) 活用

### 5.1 MCP サーバーの役割

MCPサーバーはClaude Codeに外部システムとの接続を提供する。データベース、ブラウザ、API、イシュートラッカーなどへのアクセスを可能にする。

### 5.2 設定スコープ

| スコープ | 方法 | 共有 |
|---------|------|------|
| プロジェクト | `.mcp.json` | git経由でチーム共有 |
| ユーザーローカル | `claude mcp add --scope local` | 個人 |
| ユーザーグローバル | `claude mcp add --scope user` | 全PJ |

### 5.3 Tool Search によるコンテキスト最適化

Claude Codeは **Tool Search** を使い、MCP ツールをオンデマンドで発見する。ツール名のみがコンテキストにロードされ、スキーマは実際に使う時だけ読み込まれる。これにより10+のMCPサーバーを接続してもコンテキストを圧迫しない（従来比 **約95%削減**）。

### 5.4 ツール命名規則

```
mcp__<server>__<tool>
```

例: `mcp__memory__create_entities`, `mcp__playwright__navigate`

Hooksのmatcherでも使用:

```json
{
  "matcher": "mcp__memory__.*",
  "hooks": [...]
}
```

### 5.5 セキュリティベストプラクティス

- インストール前にソースコードを監査
- 公式サーバーを優先
- 最小権限の原則（読み取り専用DBユーザー、fine-grainedなAPIトークン）
- `${env:VAR_NAME}` 構文で秘密情報を環境変数から参照

```json
{
  "mcpServers": {
    "db": {
      "command": "npx",
      "args": ["@mcp/postgres"],
      "env": {
        "DATABASE_URL": "${env:DB_URL}"
      }
    }
  }
}
```

### 5.6 推奨MCPサーバー

| サーバー | 用途 |
|---------|------|
| Playwright | ブラウザ自動操作、UI検証 |
| GitHub | Issue、PR、コードレビュー |
| PostgreSQL/MySQL | データベースクエリ |
| Memory | エンティティ・リレーション記憶 |
| Figma | デザイン統合 |

### 5.7 限界

- 認証が必要なサービスへの接続は追加設定が必要（OAuth、Bearer Token等）
- MCPサーバーの品質はコミュニティ依存（公式以外は要監査）
- ツール定義が複雑すぎるとコンテキスト効率が低下

> **出典**: [Best Practices](https://code.claude.com/docs/en/best-practices), [MCP Authentication Guide](https://www.truefoundry.com/blog/mcp-authentication-in-claude-code), [How to Structure Claude Code for Production](https://dev.to/lizechengnet/how-to-structure-claude-code-for-production-mcp-servers-subagents-and-claudemd-2026-guide-4gjn)

---

## 6. プロンプトエンジニアリング（Claude Code特有）

### 6.1 最重要原則: 検証手段を与える

**Claude Codeの効果を最大化する最もレバレッジの高い行動は、自己検証手段を提供すること。**

```
BAD:  "implement a function that validates email addresses"
GOOD: "write a validateEmail function. test cases: user@example.com is true,
       invalid is false, user@.com is false. run the tests after implementing"
```

### 6.2 4フェーズワークフロー

1. **Explore** (Plan Mode) -- コードを読んで理解
2. **Plan** -- 実装計画を作成（`Ctrl+G` でエディタで編集可能）
3. **Implement** (Normal Mode) -- 計画に基づいてコーディング
4. **Commit** -- コミットとPR作成

小さなタスク（1行修正、typo修正）ではPlanフェーズをスキップ。

### 6.3 具体的なプロンプトパターン

| パターン | Before | After |
|---------|--------|-------|
| スコープ指定 | "add tests for foo.py" | "write a test for foo.py covering the edge case where the user is logged out. avoid mocks." |
| ソース指定 | "why does ExecutionFactory have a weird api?" | "look through ExecutionFactory's git history and summarize how its api came to be" |
| 既存パターン参照 | "add a calendar widget" | "look at how existing widgets are implemented. HotDogWidget.php is a good example. follow the pattern." |
| 症状記述 | "fix the login bug" | "users report login fails after session timeout. check src/auth/, especially token refresh. write a failing test, then fix." |

### 6.4 大規模タスクの分割パターン

**インタビューモード**: Claudeに自分をインタビューさせる。

```
I want to build [brief description]. Interview me in detail using the AskUserQuestion tool.
Ask about technical implementation, UI/UX, edge cases, concerns, and tradeoffs.
Keep interviewing until we've covered everything, then write a complete spec to SPEC.md.
```

仕様完成後、**新しいセッション**で実装を開始する（クリーンなコンテキストで実装に集中できる）。

### 6.5 コンテキスト効率の最大化

1. **CLIツールを使う**: `gh`, `aws`, `gcloud` は最もコンテキスト効率が良い外部サービス連携手段
2. **サブエージェントで調査を委譲**: 調査結果がメインコンテキストを汚さない
3. **`/btw` で軽い質問**: コンテキストに入らないオーバーレイで回答表示
4. **`/clear` を頻繁に**: 無関係なタスク間でリセット
5. **`/compact` にフォーカスを指定**: `/compact Focus on the API changes`
6. **`@` でファイル参照**: パスを説明する代わりに直接参照

### 6.6 よくある失敗パターン

| パターン | 問題 | 対策 |
|---------|------|------|
| キッチンシンクセッション | 無関係なタスクが混在 | `/clear` でタスク間リセット |
| 修正の繰り返し | 失敗アプローチが文脈を汚染 | 2回失敗したら `/clear` + 学びを反映した新プロンプト |
| 過剰なCLAUDE.md | 重要なルールが埋もれる | 厳選して削る。HookやSkillに移行 |
| 信頼して検証しない | エッジケースの見落とし | 常にテスト・スクリプト・スクリーンショットで検証 |
| 無制限の調査 | Claudeが大量のファイルを読んでコンテキスト消費 | スコープを絞るか、サブエージェントに委譲 |

### 6.7 サブエージェントへの指示の書き方

```markdown
---
name: security-reviewer
description: Reviews code for security vulnerabilities
tools: Read, Grep, Glob, Bash
model: opus
---
You are a senior security engineer. Review code for:
- Injection vulnerabilities (SQL, XSS, command injection)
- Authentication and authorization flaws
- Secrets or credentials in code
- Insecure data handling

Provide specific line references and suggested fixes.
```

**descriptionが全て**: Claudeはdescriptionだけで委譲判断する。具体的で行動指向的に書く。

> **出典**: [Best Practices](https://code.claude.com/docs/en/best-practices), [Sub-agents](https://code.claude.com/docs/en/sub-agents), [Prompting Best Practices - Claude API](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)

---

## 7. Agent SDK

### 7.1 概要

Claude Agent SDK（旧Claude Code SDK）は、Claude Codeの全機能をPython/TypeScriptライブラリとして提供する。エージェントループ、組み込みツール、コンテキスト管理がプログラマブルに使える。

```python
from claude_agent_sdk import query, ClaudeAgentOptions

async for message in query(
    prompt="Find and fix the bug in auth.py",
    options=ClaudeAgentOptions(allowed_tools=["Read", "Edit", "Bash"]),
):
    print(message)
```

### 7.2 SDK vs Client SDK

| | Client SDK | Agent SDK |
|---|---|---|
| ツール実行 | 自前で実装 | Claude が自律的に処理 |
| ツールループ | `while stop_reason == "tool_use"` を自分で回す | `query()` が全て処理 |
| 組み込みツール | なし | Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch, AskUserQuestion |

### 7.3 主要機能

| 機能 | 説明 |
|------|------|
| Built-in Tools | ファイル操作、コマンド実行、Web検索 |
| Hooks | ライフサイクルイベントにコールバック関数を登録 |
| Subagents | 専門エージェントにタスク委譲 |
| MCP | 外部サービス接続（Playwright, Slack, GitHub等） |
| Permissions | ツール単位の許可制御 |
| Sessions | コンテキスト維持、再開、フォーク |
| Skills | `.claude/skills/` のスキルファイルを読み込み |
| CLAUDE.md | `setting_sources=["project"]` でプロジェクト設定を読み込み |

### 7.4 設計パターン（Anthropic推奨）

| パターン | 説明 | 用途 |
|---------|------|------|
| **Single Agent** | 単一タスク完遂 | シンプルな修正、分析 |
| **Prompt Chaining** | 多段ワークフロー | 調査 → 計画 → 実装 |
| **Router** | 条件分岐ルーティング | タスク種別による振り分け |
| **Orchestrator-Worker** | 階層的エージェント | メインが委譲、ワーカーが実行 |
| **Swarm** | 水平的マルチエージェント | 大規模並列作業 |

### 7.5 認証

| プロバイダ | 環境変数 |
|-----------|---------|
| Anthropic API | `ANTHROPIC_API_KEY` |
| Amazon Bedrock | `CLAUDE_CODE_USE_BEDROCK=1` + AWS認証 |
| Google Vertex AI | `CLAUDE_CODE_USE_VERTEX=1` + GCP認証 |
| Microsoft Azure | `CLAUDE_CODE_USE_FOUNDRY=1` + Azure認証 |

### 7.6 限界

- CLIでのインタラクティブ操作はSDKからは利用不可（`-p` モードに近い）
- 認証方法は公式APIキーまたは公式クラウドプロバイダーのみ（claude.aiログインは不可）

> **出典**: [Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview), [Claude Agent SDK - npm](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk), [Agent SDK Deep Dive - Medium](https://medium.com/@shivanshmay2019/claude-agent-sdk-deep-dive-what-it-means-to-use-claude-code-as-a-library-773aea121787)

---

## 8. サブエージェントとAgent Teams

### 8.1 サブエージェント

各サブエージェントは**独自のコンテキストウィンドウ**で動作し、メインの会話を汚さない。

#### 組み込みサブエージェント

| エージェント | モデル | ツール | 用途 |
|------------|--------|-------|------|
| Explore | Haiku | 読み取り専用 | コード検索、探索 |
| Plan | 親を継承 | 読み取り専用 | プランモードでの調査 |
| General-purpose | 親を継承 | 全ツール | 複雑な多段タスク |

#### カスタムサブエージェントの配置

| 優先度 | 配置 | スコープ |
|--------|------|---------|
| 1 (最高) | Managed settings | 組織全体 |
| 2 | `--agents` CLI | 現在のセッション |
| 3 | `.claude/agents/` | 現在のPJ |
| 4 | `~/.claude/agents/` | 全PJ |
| 5 (最低) | プラグイン | プラグイン有効時 |

#### Frontmatter フィールド

```yaml
---
name: code-reviewer
description: Expert code reviewer for quality and security
tools: Read, Grep, Glob, Bash
disallowedTools: Write, Edit
model: sonnet
permissionMode: default
maxTurns: 50
memory: user
effort: medium
color: "#4a90d9"
---
```

### 8.2 Agent Teams（研究プレビュー）

Agent Teamsは複数のClaude Codeインスタンスが並列で作業し、相互通信する仕組み。

- **Team Lead**: メインセッション、作業の調整とタスク割り当て
- **Teammates**: 独自コンテキストで独立作業
- **共有タスクリスト**: 依存関係管理、自動ロック

#### 有効化

```json
{
  "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": true
}
```

#### 効果的なケース

- 複数の仮説を並列テスト（デバッグ）
- フロントエンド/バックエンド/テストの同時作業
- 大規模マイグレーション

#### コスト考慮

- トークンはチームメイトごとに線形スケール
- 調整オーバーヘッドが加算される
- Anthropic社例: 16エージェントで100,000行のCコンパイラ構築、約2,000セッション、約$20,000

> **出典**: [Create custom subagents](https://code.claude.com/docs/en/sub-agents), [Agent Teams](https://code.claude.com/docs/en/agent-teams), [Building a C compiler with a team of parallel Claudes](https://www.anthropic.com/engineering/building-c-compiler)

---

## 9. 運用パターン

### 9.1 CI/CD 統合

```bash
# 非インタラクティブモード
claude -p "Explain what this project does"

# 構造化出力
claude -p "List all API endpoints" --output-format json

# ストリーミング
claude -p "Analyze this log file" --output-format stream-json

# ツール制限付き（バッチ処理用）
for file in $(cat files.txt); do
  claude -p "Migrate $file from React to Vue. Return OK or FAIL." \
    --allowedTools "Edit,Bash(git commit *)"
done
```

GitHub Actionsとの統合で、コードレビューやイシュートリアージを自動化可能。

### 9.2 マルチセッション運用

| 環境 | 特徴 |
|------|------|
| Desktop App | 複数ローカルセッションを視覚管理、個別worktree |
| Claude Code on the web | Anthropicの隔離VM上で実行 |
| Agent Teams | 共有タスク・メッセージングで自動調整 |

#### Writer/Reviewer パターン

| Session A (Writer) | Session B (Reviewer) |
|---|---|
| `Implement a rate limiter for our API endpoints` | |
| | `Review the rate limiter implementation. Look for edge cases, race conditions.` |
| `Address review feedback: [Session B output]` | |

### 9.3 チーム開発

- CLAUDE.mdをgitにチェックイン
- `.claude/agents/` のカスタムエージェントもバージョン管理
- `.claude/rules/` でチーム標準を共有
- `CLAUDE.local.md` で個人設定（`.gitignore` に追加）
- `claudeMdExcludes` でモノレポ内の不要なCLAUDE.mdを除外

### 9.4 権限管理

| モード | 動作 |
|--------|------|
| Default | 編集・コマンドごとに確認 |
| Auto-accept edits | ファイル編集は自動、コマンドは確認 |
| Plan mode | 読み取り専用、変更なし |
| Auto mode | バックグラウンド分類器が安全性評価 |

```bash
# 非インタラクティブでのAuto mode
claude --permission-mode auto -p "fix all lint errors"
```

### 9.5 セッション管理

```bash
claude --continue       # 直近セッション再開
claude --resume         # セッション一覧から選択
claude --fork-session   # セッションをフォーク（元は変更なし）
```

`/rename` でセッションに名前を付けて管理: `"oauth-migration"`, `"debugging-memory-leak"`

> **出典**: [Best Practices](https://code.claude.com/docs/en/best-practices), [How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works)

---

## 10. 現行システムへの適用提案

### 10.1 仮想カンパニーシステムへの最適化（推測）

現在の `.company/` アーキテクチャに対して、今回の知見を基に考えられる改善ポイント:

| 領域 | 現状の推測 | 改善案 |
|------|----------|--------|
| CLAUDE.md サイズ | HD CLAUDE.mdが大きい可能性 | 200行以内に絞り、詳細は `references/` に分離 |
| ルールの分散 | `.claude/rules/` に分割済み | パス固有ルールの活用で条件ロードを増やす |
| サブエージェント | `.claude/agents/` で定義済み | `memory: user` で各部署エージェントにAuto Memory付与 |
| コンテキスト管理 | 大規模タスクでの圧縮問題 | Compact Instructions をCLAUDE.mdに追記 |
| Hooks活用 | 一部活用中 | PostToolUse で lint、PreToolUse で危険コマンドブロック |
| MCP | プロファイル管理あり | Tool Search活用でコンテキスト効率化 |

### 10.2 Skills vs CLAUDE.md の使い分け

| 常に必要 | 時々必要 |
|---------|---------|
| CLAUDE.md / rules | Skills |
| 毎セッションロード | オンデマンドロード |
| コーディング標準、ワークフロー | ドメイン知識、特定タスク手順 |

部署固有の手順はスキルに移行することで、コンテキスト効率が向上する。

---

## 限界の明示（わからないこと）

1. **内部プロンプトの詳細**: Claude Codeのシステムプロンプトの正確な内容は非公開
2. **Compactionのアルゴリズム**: 何を保持し何を捨てるかの詳細なロジックは非公開
3. **Auto Memoryの判断基準**: 何を記憶すべきと判断するかの詳細は非公開
4. **Agent Teams の安定性**: 研究プレビュー段階であり、本番利用のベストプラクティスは発展途上
5. **トークンコストの最適化**: 具体的なトークン消費量の内訳は計測が難しい
6. **マルチモデル切替の効果**: Haiku/Sonnet/Opusの使い分けの定量的効果は不明
7. **大規模チーム（10人以上）での運用事例**: 公開事例が限られる

---

## 壁打ちモードへの導線

以下の問いかけで、社長の環境に合わせた深掘りが可能です:

1. **「現在のCLAUDE.mdの行数はどれくらいですか？200行を超えている場合、何を削るか一緒に考えましょう」**
2. **「各部署エージェントのdescriptionは具体的ですか？実際に正しく委譲されていますか？」**
3. **「Compaction後に失われて困った情報はありますか？Compact Instructionsを設計しましょう」**
4. **「Hooksで自動化したいワークフローはありますか？現在手動でやっている繰り返し作業は？」**
5. **「Agent Teamsを試してみたいタスクはありますか？並列化の費用対効果を検討しましょう」**
6. **「MCPサーバーは何個接続していますか？Tool Searchの効果を確認しましょう」**
7. **「Agent SDKでCI/CDパイプラインに組み込みたい自動化はありますか？」**

---

## ネクストアクション

- [ ] 現CLAUDE.mdの棚卸し（行数チェック、不要な記述の削除）
- [ ] Compact Instructions セクションの追加
- [ ] パス固有ルール（`.claude/rules/` の `paths` frontmatter）の導入検討
- [ ] 各部署サブエージェントのAuto Memory有効化検討
- [ ] PostToolUse Hook での自動lint導入
- [ ] Agent Teams の試験的導入（並列デバッグ等の小規模ケースから）
- [ ] Agent SDK を使ったCI/CD自動化の検討

---

## ソース一覧

### 公式ドキュメント
- [Best Practices for Claude Code](https://code.claude.com/docs/en/best-practices)
- [How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works)
- [How Claude remembers your project (Memory)](https://code.claude.com/docs/en/memory)
- [Hooks Reference](https://code.claude.com/docs/en/hooks)
- [Create custom subagents](https://code.claude.com/docs/en/sub-agents)
- [Agent Teams](https://code.claude.com/docs/en/agent-teams)
- [Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Compaction - Claude API Docs](https://platform.claude.com/docs/en/build-with-claude/compaction)
- [Context Engineering Cookbook](https://platform.claude.com/cookbook/tool-use-context-engineering-context-engineering-tools)
- [Memory Tool - Claude API Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool)
- [Prompting Best Practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)

### コミュニティ・技術ブログ
- [CLAUDE.md Best Practices - UX Planet](https://uxplanet.org/claude-md-best-practices-1ef4f861ce7c)
- [CLAUDE.md Best Practices: From Basic to Adaptive - DEV](https://dev.to/cleverhoods/claudemd-best-practices-from-basic-to-adaptive-9lm)
- [Claude Code Best Practices - ranthebuilder](https://ranthebuilder.cloud/blog/claude-code-best-practices-lessons-from-real-projects/)
- [Claude Code Best Practice (GitHub)](https://github.com/shanraisshan/claude-code-best-practice)
- [Claude Code Ultimate Guide (GitHub)](https://github.com/FlorianBruniaux/claude-code-ultimate-guide)
- [Claude Code Setup: MCP, Hooks, Skills](https://okhlopkov.com/claude-code-setup-mcp-hooks-skills-2026/)
- [How to Structure Claude Code for Production - DEV](https://dev.to/lizechengnet/how-to-structure-claude-code-for-production-mcp-servers-subagents-and-claudemd-2026-guide-4gjn)
- [Claude Code Subagents Delegation Patterns - Medium](https://medium.com/@richardhightower/claude-code-subagents-and-main-agent-coordination-a-complete-guide-to-ai-agent-delegation-patterns-a4f88ae8f46c)
- [Agent SDK Deep Dive - Medium](https://medium.com/@shivanshmay2019/claude-agent-sdk-deep-dive-what-it-means-to-use-claude-code-as-a-library-773aea121787)
- [Building a C compiler with parallel Claudes - Anthropic Engineering](https://www.anthropic.com/engineering/building-c-compiler)
- [Claude Code Hooks Guide 2026 - Serenities AI](https://serenitiesai.com/articles/claude-code-hooks-guide-2026)
- [AI Harness Design Patterns - Claude Lab](https://claudelab.net/en/articles/claude-code/claude-code-ai-harness-design-patterns)
- [How Claude Code Got Better by Protecting More Context](https://hyperdev.matsuoka.com/p/how-claude-code-got-better-by-protecting)
- [MCP Authentication Guide - TrueFoundry](https://www.truefoundry.com/blog/mcp-authentication-in-claude-code)
- [Persistent Memory Across Compactions - GitHub Issue](https://github.com/anthropics/claude-code/issues/34556)
- [CLAUDE.md Best Practices - Arize](https://arize.com/blog/claude-md-best-practices-learned-from-optimizing-claude-code-with-prompt-learning/)
- [Awesome Claude Code (GitHub)](https://github.com/hesreallyhim/awesome-claude-code)
