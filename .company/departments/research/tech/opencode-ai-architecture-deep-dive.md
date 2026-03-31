# OpenCode 徹底解剖 -- OSSエージェント型AIコーディングツールの設計と思想

- **調査日**: 2026-03-31
- **ステータス**: completed
- **調査チーム**: 技術調査チーム
- **対象**: OpenCode (https://opencode.ai)

---

## 目次

1. [OpenCodeとは何か](#1-opencodeとは何か)
2. [コアアーキテクチャ](#2-コアアーキテクチャ)
3. [エージェントループの仕組み](#3-エージェントループの仕組み)
4. [利用可能なツール一覧と挙動](#4-利用可能なツール一覧と挙動)
5. [セッション・会話管理](#5-セッション会話管理)
6. [マルチモデル対応の実装](#6-マルチモデル対応の実装)
7. [マルチエージェント（Agent Teams）](#7-マルチエージェントagent-teams)
8. [Claude Code / Cursor との比較](#8-claude-code--cursor-との比較)
9. [ダッシュボードに組み込む場合の設計インプリケーション](#9-ダッシュボードに組み込む場合の設計インプリケーション)
10. [結論とネクストアクション](#10-結論とネクストアクション)

---

## 1. OpenCodeとは何か

OpenCodeは、**OSSのエージェント型AIコーディングツール**。ターミナル（TUI）、デスクトップアプリ、IDE拡張、Webインターフェースの4形態で利用可能。

### 基本情報

| 項目 | 内容 |
|------|------|
| 開発元 | Anomaly Innovations（SST/Serverless Stackのチーム） |
| ライセンス | MIT License |
| GitHub Stars | 120,000+ |
| コントリビューター | 800+ |
| 月間利用者 | 500万+ |
| 言語 | TypeScript + Zig（TUI描画部分） |
| 公式サイト | https://opencode.ai |
| GitHub | https://github.com/opencode-ai/opencode |

### 経緯

初期はGo + Bubble Teaで構築されたターミナルアプリとして2025年に公開。2025年9月にリポジトリがアーカイブされ、**Crushとしてリブランド**。その後OpenCodeとして再構築され、TypeScript + Zigベースの新アーキテクチャで大幅に進化した。現在のバージョンはクライアント-サーバー分離型アーキテクチャを採用し、TUI以外にもデスクトップ・IDE・Webクライアントをサポートしている。

**ソース:**
- [OpenCode公式サイト](https://opencode.ai)
- [GitHub: opencode-ai/opencode](https://github.com/opencode-ai/opencode)
- [OpenCode Docs](https://opencode.ai/docs/)

---

## 2. コアアーキテクチャ

OpenCodeの設計は**10の設計要素**に分解できる。以下にそのアーキテクチャ全体像を示す。

### アーキテクチャ全体図

```
+-------------------+     +-------------------+     +-------------------+
|   TUI Client      |     |  Desktop Client   |     |   IDE Extension   |
|   (Zig + TS)      |     |  (Electron等)     |     |   (VS Code等)     |
+--------+----------+     +--------+----------+     +--------+----------+
         |                         |                         |
         +------------+------------+------------+------------+
                      |                         |
                      v                         v
              +-------+-------------------------+-------+
              |           HTTP Server (REST + SSE)       |
              +-------+-------------------------+-------+
                      |                         |
         +------------+------------+            |
         |                         |            |
    +----v-----+            +------v------+     |
    | Agent    |            | Session     |     |
    | Loop     |            | Manager     |     |
    | Engine   |            | (SQLite)    |     |
    +----+-----+            +-------------+     |
         |                                      |
    +----v-----+     +-------------+     +------v------+
    | Tool     |     | Plugin      |     | Provider    |
    | Registry |     | System      |     | Abstraction |
    | (14+)    |     | (20+ hooks) |     | Layer       |
    +----+-----+     +-------------+     +------+------+
         |                                      |
    +----v-----+                         +------v------+
    | MCP      |                         | 75+ LLM     |
    | Servers  |                         | Providers   |
    +----------+                         +-------------+
```

### 設計の10要素

#### (1) クライアント-サーバー分離
HTTPサーバー + マルチクライアントモデル。中央サーバーがエージェントロジックを管理し、TUI/Web/Desktop/IDEクライアントがREST APIとSSE（Server-Sent Events）で接続する。これにより複数クライアントの同時接続とリアルタイム同期が可能。

#### (2) エージェントループパターン
後述（セクション3で詳述）

#### (3) ツールシステム（14種の組み込みツール）
後述（セクション4で詳述）

#### (4) プロバイダー抽象化レイヤー
`ProviderTransform`名前空間がプロバイダー固有の癖を吸収。例：Anthropicの空コンテンツ除去、MistralのID正規化。これにより`LLM.stream()`呼び出しは統一インターフェースで動作する。

#### (5) OpenTUI（カスタムターミナルフレームワーク）
Zig + TypeScriptで**60FPS描画**を実現。Zigがフレーム差分とANSI生成を担当、TypeScriptがSolidJSリアクティブバインディングを提供。レイアウトにYoga、シンタックスハイライトにTree-sitterを使用。

#### (6) LSP統合
Language Server Protocolとの統合により、`read`ツールが自動的にLSP診断情報を含む。型推論やエラー検出がファイル読み取り時に自動的に付加される。

#### (7) MCPプロトコルサポート
ローカル（CLIスポーン）とリモート（HTTP接続）の外部ツールサーバーを、組み込みツールと統一された`ToolRegistry`に登録可能。

#### (8) コンテキスト管理（Compaction）
3段階アプローチ：
1. 20,000トークンを超える古いツール出力をプルーニング（直近40,000トークンは保護）
2. 必要に応じて隠しCompactionエージェントで要約
3. 古いメッセージを要約で置換

#### (9) セッション管理
後述（セクション5で詳述）

#### (10) プラグインシステム（20+フック）
イベント駆動型プラグインが`chat.params`、`chat.messages.transform`、`tool.execute.before/after`、`message.updated`等のフックで実行。パイプラインパターンで連鎖する。

**ソース:**
- [OpenCode の技術を徹底解剖 - 10 の設計要素 (Qiita)](https://qiita.com/cvusk/items/cb879d6168a0bf7bb307)
- [Inside OpenCode: How to Build an AI Coding Agent That Actually Works (Medium)](https://medium.com/@gaharwar.milind/inside-opencode-how-to-build-an-ai-coding-agent-that-actually-works-28c614494f4f)

---

## 3. エージェントループの仕組み

OpenCodeの核心は**エージェントループ**（Agentic Loop）にある。これは単なるLLMチャットではなく、「考える → ツール実行 → 結果を見る → また考える」の反復サイクルを自律的に回す仕組み。

### ループの流れ

```
ユーザー入力
    |
    v
[1] メッセージ作成 & コンテキスト構築
    |
    v
[2] LLMストリーミング呼び出し
    |
    v
[3] レスポンス解析
    |
    +---> finish_reason == "tool-calls" ?
    |         |
    |    Yes  |  No
    |         |   |
    |         v   v
    |    [4] ツール実行  [6] 応答を記録・表示
    |         |                |
    |         v                v
    |    [5] 結果をメッセージに追加   終了
    |         |
    |         +-------> [2] に戻る（ループ継続）
```

### 重要な設計ポイント

1. **`finish_reason`による制御**: LLMが`tool_use`（ツール呼び出し）を返した場合にのみループが継続。LLMが「もうツールは不要」と判断した時点で自然にループが終了する。

2. **ステップ数制限**: `steps`設定でエージェントの最大反復回数を制御可能。上限到達時、エージェントは作業の要約と残りタスクの推奨事項を生成する特別プロンプトを受け取る。

3. **6段階パイプライン**: 各ループ反復は以下の6ステップを順次実行：
   - 変更のリバート処理
   - 入力の処理
   - キューの管理
   - コンテキストの処理
   - ツールの実行
   - 状態更新の永続化とリアルタイムイベント発行

4. **パーミッション割り込み**: ツール実行前にパーミッションチェックが入る。`ask`設定のツールは実行前にユーザー承認を要求し、ループを一時停止する。

### なぜ「エージェント」なのか

従来のLLMチャットは「質問→回答」の1ターン完結。エージェントは：
- **自律的にコンテキストを収集する**（ファイルを読む、grepする、Webを検索する）
- **実際にコードを変更する**（ファイル書き込み、パッチ適用、コマンド実行）
- **結果を確認して修正する**（テスト実行→失敗→修正→再テスト）
- **複数ステップの計画を立てて実行する**（todowrite→計画→実行→検証）

これが「opencode的な挙動」の本質。

**ソース:**
- [OpenCode Docs: Agents](https://opencode.ai/docs/agents/)
- [Qiita: OpenCode の技術を徹底解剖](https://qiita.com/cvusk/items/cb879d6168a0bf7bb307)

---

## 4. 利用可能なツール一覧と挙動

### 組み込みツール（14種）

| ツール | 機能 | パーミッション注記 |
|--------|------|-------------------|
| `bash` | シェルコマンド実行。プロジェクト環境でコマンドを実行する | globパターンでコマンド別に制御可能 |
| `read` | ファイル内容取得。行範囲指定対応。LSP診断情報を自動付加 | 通常allow |
| `write` | 新規ファイル作成・上書き | Build: allow, Plan: ask |
| `edit` | 正確な文字列置換によるファイル修正（AST指向） | Build: allow, Plan: ask |
| `apply_patch` | パッチファイルの適用 | Build: allow, Plan: ask |
| `grep` | 正規表現によるコードベース横断検索 | 通常allow |
| `glob` | パターンマッチングによるファイル検索（更新日順ソート） | 通常allow |
| `list` | ディレクトリ内容表示。globフィルタ対応 | 通常allow |
| `lsp` | コードインテリジェンス（定義ジャンプ、参照検索、ホバー情報）※実験的 | 通常allow |
| `task` | サブエージェント委譲。複雑なタスクを専門サブエージェントに分割実行 | 設定で制御 |
| `skill` | SKILL.mdファイルを会話にロード | 通常allow |
| `todowrite` | セッション中のタスクリスト管理 | 通常allow |
| `webfetch` | Webページ内容取得 | ask推奨 |
| `websearch` | Exa AI経由のWeb検索（APIキー不要） | ask推奨 |
| `question` | 実行中にユーザーに入力を求める | N/A |

### パーミッションシステム

`opencode.json`で各ツールの挙動を制御：

```json
{
  "permissions": {
    "bash": "ask",
    "write": "allow",
    "edit": "allow",
    "webfetch": "deny",
    "mymcp_*": "ask"
  }
}
```

3段階の制御：
- **`allow`**: 承認なしで自動実行
- **`ask`**: 実行前にユーザー承認を要求
- **`deny`**: 実行不可

ワイルドカード（`*`）でバッチ制御が可能。MCPツールも同じ体系で制御される。

### カスタムツール & MCP

- カスタムツール: LLMが呼び出せる独自関数を定義可能
- MCPサーバー: ローカル（CLIスポーン）とリモート（HTTP）の外部ツールサーバーを統一レジストリで管理

**ソース:**
- [OpenCode Docs: Tools](https://opencode.ai/docs/tools/)
- [Qiita: OpenCode の技術を徹底解剖](https://qiita.com/cvusk/items/cb879d6168a0bf7bb307)

---

## 5. セッション・会話管理

### SQLiteベースの永続化

プロジェクトごとにSQLiteデータベースを使用。`Database.effect`パターンにより、**トランザクションコミット後にのみイベントが発行される**ことを保証。これはクライアントが実データより先にイベントを観測するレースコンディションを防ぐ重要な設計。

### セッション機能

| 機能 | 説明 |
|------|------|
| セッション保存・復元 | 会話履歴の完全な永続化 |
| セッションフォーク | 会話を分岐して別の方向性を試す |
| セッション共有 | リンク生成による他者との共有 |
| 親子セッション | サブエージェントが生成する子セッションをキーバインドで遷移 |
| 自動命名 | 隠しTitleエージェントが自動的にセッション名を生成 |

### Auto Compact（自動圧縮）

モデルのコンテキスト上限の95%に達すると自動発動：

1. 20,000トークンを超える古いツール出力をプルーニング（直近40,000トークンは保護）
2. 隠しCompactionエージェントが残りを要約
3. 古いメッセージを要約で置換し、新しいセッションを作成して継続性を維持

### コスト追跡

メッセージごとにトークン使用量とAPIコストをトラッキング。ユーザーは現在のセッションのコスト状況をリアルタイムで把握可能。

**ソース:**
- [OpenCode Docs](https://opencode.ai/docs/)
- [Qiita: OpenCode の技術を徹底解剖](https://qiita.com/cvusk/items/cb879d6168a0bf7bb307)

---

## 6. マルチモデル対応の実装

### Provider Abstraction Layer

OpenCodeは**75以上のLLMプロバイダー**をModels.dev経由でサポート。

#### 対応プロバイダー

| プロバイダー | 主要モデル |
|-------------|-----------|
| Anthropic | Claude Opus 4.6, Claude Sonnet 4, Claude 3.7 Sonnet |
| OpenAI | GPT-4.1系, GPT-4o系, O1/O3/O4系 |
| Google | Gemini 2.5, Gemini 2.5 Flash, Gemini 2.0 Flash |
| GitHub Copilot | 15+モデル（GPT-4o, Claude, O1/O3, Gemini等） |
| AWS Bedrock | Claude 3.7 Sonnet |
| Azure OpenAI | GPT-4.1/4.5, O1/O3, O4 Mini |
| Google Cloud VertexAI | Gemini 2.5系 |
| Groq | Llama 4系, QWEN, Deepseek R1 |
| ローカル | Ollama経由のローカルモデル |

#### ProviderTransform

プロバイダー固有の差異を`ProviderTransform`名前空間で吸収：
- Anthropic: 空コンテンツの除去
- Mistral: IDの正規化
- その他プロバイダー固有の変換

これにより、エージェントループ本体はプロバイダーを意識せず統一インターフェースで`LLM.stream()`を呼び出せる。

### Per-Agent Model設定

エージェントごとに異なるモデルを指定可能：

```json
{
  "agents": {
    "build": { "model": "claude-opus-4-6" },
    "plan": { "model": "gemini-2.5-flash" },
    "general": { "model": "gpt-4.1" }
  }
}
```

**ソース:**
- [OpenCode Docs](https://opencode.ai/docs/)
- [GitHub: opencode-ai/opencode](https://github.com/opencode-ai/opencode)

---

## 7. マルチエージェント（Agent Teams）

### プライマリエージェント

| エージェント | 種類 | ツールアクセス | 用途 |
|-------------|------|--------------|------|
| **Build** | プライマリ | 全ツール有効 | 標準的な開発作業 |
| **Plan** | プライマリ | 全てask | 分析・計画（意図しない変更を防止） |

Tabキーで切り替え可能。

### サブエージェント

| エージェント | ツールアクセス | 用途 |
|-------------|--------------|------|
| **General** | 全ツール有効 | 複雑な質問のリサーチ、マルチステップ並列タスク |
| **Explore** | 読み取り専用 | コードベース検索、パターン発見 |

`@`メンションで明示的に呼び出し可能（例: `@general help me search for this function`）。

### 隠しシステムエージェント

- **Compaction**: コンテキスト圧縮
- **Title**: セッション命名
- **Summary**: セッション要約

### Agent Teamsアーキテクチャ（Claude Codeとの比較）

OpenCodeは2026年初頭にClaude Codeが実装したAgent Teamsに相当する機能を独自実装。

#### メッセージング

| 項目 | Claude Code | OpenCode |
|------|------------|----------|
| ストレージ | JSON（全体読み書き、O(N)） | JSONL（追記のみ、O(1)） |
| トポロジー | リーダー経由が主 | **完全ピアツーピア** |
| Wake機構 | リーダーがポーリング | **自動Wake**（メッセージ到着でセッション再起動） |
| マルチモデル | 単一プロバイダー | **異なるプロバイダーのモデルを混合可能** |

#### デュアルステートマシン

OpenCodeは2層のステートマシンを実装：
1. **メンバーステータス**（5状態）: ready, busy, shutdown_requested, shutdown, error
2. **実行ステータス**（10状態）: プロンプトループ内の位置を精密に追跡

UI表示には実行ステータスの詳細を、リカバリーロジックにはメンバーステータスの粗い粒度を使い分ける。

#### クラッシュリカバリー

1. パーミッション復元ハンドラを先に登録
2. 全「busy」メンバーを「ready」に強制遷移
3. リードに中断されたチームメイトの通知を注入
4. リカバリー完了後にクリーンアップイベントをサブスクライブ

**意図的に自動再起動なし** -- クラッシュ後に暴走エージェントがAPIクレジットを消費することを防止。

**ソース:**
- [Building Agent Teams in OpenCode (DEV Community)](https://dev.to/uenyioha/porting-claude-codes-agent-teams-to-opencode-4hol)
- [OpenCode Docs: Agents](https://opencode.ai/docs/agents/)

---

## 8. Claude Code / Cursor との比較

### 総合比較

| 項目 | OpenCode | Claude Code | Cursor |
|------|----------|-------------|--------|
| **形態** | ターミナル/デスクトップ/IDE/Web | ターミナル | IDE（VS Code fork） |
| **ライセンス** | MIT (OSS) | プロプライエタリ | プロプライエタリ |
| **費用** | 無料 + APIコスト | $20/月（Claude Pro） | $20/月（Pro） |
| **モデル** | 75+プロバイダー | Claude限定 | 複数（主にClaude/GPT） |
| **コンテキスト窓** | モデル依存 | 1Mトークン（Opus 4.6） | モデル依存 |
| **SWE-bench** | モデル依存 | 80.8%（Opus 4.6） | モデル依存 |
| **Agent Teams** | ピアツーピア、マルチモデル | リーダー中心、単一プロバイダー | なし（2026/03時点） |
| **拡張性** | プラグイン20+フック、MCP、カスタムツール | MCP、CLAUDE.md | 拡張機能 |
| **UI** | 60FPS TUI（Zig）+ デスクトップ | シンプルTUI | 完全なIDE |

### 各ツールの強み

**OpenCode**:
- OSSであること（カスタマイズ・セルフホスト・監査が可能）
- マルチプロバイダー対応（モデルロックインなし）
- プラグインシステムによる高い拡張性
- Agent Teamsでマルチモデル混合が可能
- 無料（APIコストのみ）

**Claude Code**:
- Opus 4.6の圧倒的推論能力 + 1Mコンテキスト窓
- SWE-bench 80.8%のトップスコア
- Anthropicによる深いモデル-ツール最適化
- git統合の深さ
- エンタープライズサポート

**Cursor**:
- 視覚的なIDE体験（VS Code互換）
- インラインコード補完（Supermaven）
- Composerモードでのマルチファイル視覚的編集
- 100万以上のユーザーベース

### Daniel Miesslerの知見

> 「Claude Codeの強みは秘密の魔法ではなく、コンテキストウィンドウ、メモリ管理、プロジェクト目標の追跡に関する非常に良いエンジニアリング。OpenCodeは同等の能力を示している。」

つまり、**差別化要因はモデルの能力とエンジニアリングの質**であり、オーケストレーションの仕組み自体は収斂しつつある。

**ソース:**
- [OpenCode vs Claude Code (Daniel Miessler)](https://danielmiessler.com/blog/opencode-vs-claude-code)
- [Cursor vs Claude Code vs Windsurf vs OpenCode: The Definitive 2026 Comparison](https://www.shareuhack.com/en/posts/cursor-vs-claude-code-vs-windsurf-2026)
- [OpenCode vs Claude Code vs Cursor: Complete Comparison for 2026 (NxCode)](https://www.nxcode.io/resources/news/opencode-vs-claude-code-vs-cursor-2026)
- [Claude Code vs Cursor vs OpenCode (Beam Terminal)](https://getbeam.dev/blog/claude-code-vs-cursor-vs-opencode-2026.html)

---

## 9. ダッシュボードに組み込む場合の設計インプリケーション

OpenCodeのアーキテクチャから、自社ダッシュボード（Circuit等）への組み込みを考えた場合の設計示唆を整理する。

### (a) クライアント-サーバー分離の恩恵

OpenCodeがHTTPサーバー + SSEで動作する設計は、**Webダッシュボードとの統合に直接的に有利**。
- ダッシュボードのフロントエンドからREST APIでエージェントにリクエスト送信
- SSEでストリーミングレスポンスをリアルタイム表示
- 複数セッションの同時表示・管理が可能

### (b) エージェントループの組み込みパターン

ダッシュボードにエージェント的振る舞いを組み込む場合の選択肢：

| パターン | 説明 | 適合度 |
|---------|------|--------|
| OpenCode直接統合 | OpenCodeサーバーを起動し、ダッシュボードからAPI呼び出し | 高（OSSなのでカスタマイズ可能） |
| エージェントループ自作 | OpenCodeの設計を参考に独自実装 | 中（学習コストあり） |
| Claude Code SDK利用 | Claude Code Agent SDKを使用 | 高（現在の基盤と整合） |

### (c) ツールパーミッションモデル

OpenCodeの3段階パーミッション（allow/ask/deny）はダッシュボードのUI設計に参考になる：
- 自動実行（バックグラウンドタスク）: allow
- ユーザー確認が必要な操作: ask（UI上に承認ダイアログ）
- 禁止操作: deny

### (d) マルチモデル戦略

OpenCodeのProviderTransformパターンは、ダッシュボードで複数モデルを使い分ける際の設計参考になる：
- タスク種別ごとに最適モデルを選択
- コスト最適化（簡単なタスクは安いモデル、複雑なタスクは高性能モデル）
- プロバイダー障害時のフォールバック

### (e) 仮説: OpenCodeを「AIバックエンド」として使う

OpenCodeサーバーをダッシュボードの裏側で動かし、エージェント機能を提供するアーキテクチャが考えられる。OSSなのでカスタマイズ・拡張が自由。ただし、現在Claude Code Agent SDKを基盤としている場合、移行コストとの天秤になる。

---

## 10. 結論とネクストアクション

### 結論

OpenCodeは**OSSエージェント型AIコーディングツールのリファレンス実装**と言える。特に以下の点が技術的に示唆深い：

1. **エージェントループは「魔法」ではなくエンジニアリング** -- finish_reason制御、パーミッション割り込み、ステップ数制限の3要素で構成される明確なパターン
2. **クライアント-サーバー分離**により、同一エージェントエンジンをTUI/Web/IDE/デスクトップで共有
3. **ProviderTransformによるモデル抽象化**が、マルチプロバイダー対応の実装パターンとして秀逸
4. **プラグインシステム（20+フック）**による拡張性設計が、独自ツール統合の参考になる
5. **Agent Teamsのピアツーピア通信とマルチモデル混合**は、Claude Codeにない独自の強み

### ネクストアクション

| 優先度 | アクション | 担当 |
|--------|-----------|------|
| 高 | OpenCodeを実際にインストールし、エージェントループの挙動を体験する | 社長 or AI開発部 |
| 高 | 「opencode的な挙動」を現在のClaude Code Agent SDK基盤でどこまで実現できているか棚卸し | AI開発部 |
| 中 | OpenCodeのプラグインシステムを調査し、ダッシュボードの拡張性設計に活かす | システム開発部 |
| 中 | ProviderTransformパターンをマルチモデル戦略に適用検討 | AI開発部 |
| 低 | OpenCode Agent Teamsの実装を深掘りし、自社マルチエージェント設計の参考にする | リサーチ部 |

---

## 限界の明示

### わからないこと・確認すれば精度が上がること

1. **実際のコード品質**: GitHubリポジトリのソースコードを直接読んでの品質評価は未実施（リポジトリがアーカイブ済み + 新版はOSSだが全コード精査は未実施）
2. **プロダクション利用の安定性**: 大規模プロジェクトでの長時間セッションの安定性に関する実測データなし
3. **Zen（有料サービス）の詳細**: OpenCode Zenのモデル選別基準・ベンチマーク詳細は非公開
4. **新アーキテクチャ（TypeScript + Zig）の成熟度**: Go版からの移行後の安定性に関するコミュニティフィードバックの網羅的収集は未実施
5. **自社ダッシュボードとの具体的な統合設計**: 実際のAPI互換性・パフォーマンスの検証は実機テストが必要

### 推測ラベル付き情報

- 推測: OpenCodeの月間500万ユーザーの数字は、ターミナル版だけでなく全インターフェースの合計と思われる
- 推測: Zig + TypeScriptのTUI基盤は、ブラウザ対応（WASM化）を視野に入れた選択の可能性がある
- 仮説: OpenCodeがClaude Codeに機能面で追いつくにつれ、差別化はモデル品質とエコシステムに収斂する

---

## 壁打ちモードへの導線

以下の問いかけで、さらに深掘りが可能です：

1. **「自社のClaude Code Agent SDK基盤で、OpenCodeのどの設計要素を取り入れたいか？」** -- 優先順位を議論
2. **「ダッシュボードにエージェント的UI（ツール実行の可視化、パーミッション承認）を追加するか？」** -- UX設計の方向性
3. **「マルチモデル対応は今の段階で必要か？それともClaude一本で十分か？」** -- コスト vs 柔軟性のトレードオフ
4. **「OpenCodeのプラグインフック（20+）のうち、自社で特に欲しいのはどれか？」** -- 拡張性設計の具体化
5. **「Agent Teamsのピアツーピア通信パターンは、自社のパイプライン品質ループ（dept-qa等）に応用できるか？」** -- 組織設計とソフトウェア設計のアナロジー

---

*調査完了: 2026-03-31 | 技術調査チーム*
