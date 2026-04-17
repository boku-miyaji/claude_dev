# ツール分類整理（タスク#3）

## 参考: Google Cloud ADK ツール分類（4カテゴリ）

| カテゴリ | 説明 | 例 |
|---------|------|-----|
| **Function Tools** | 自作のカスタム関数 | ビジネスロジック、データ処理 |
| **Built-in Tools** | フレームワーク組み込み | Google Search, Code Execution, RAG |
| **Third-Party Tools** | 外部フレームワーク連携 | LangChain等のツールを再利用 |
| **MCP Tools** | MCP標準プロトコル経由 | 標準化されたエージェント-ツール通信 |

## 現在のClaude Code スキル分類

### 現在登録されているスキル一覧と分類案

| スキル名 | 現在の分類 | ADK分類で言えば | 提案カテゴリ |
|---------|-----------|----------------|-------------|
| company | ai-company (自作プラグイン) | Function Tool | 組織管理 |
| permission | ai-company | Function Tool | 組織管理 |
| invoice | ai-company | Function Tool | 財務 |
| no-edit | ai-company | Function Tool | モード切替 |
| pptx-aces-rikyu | 自作スキル | Function Tool | 資料作成 |
| pptx-rikyu | 自作スキル | Function Tool | 資料作成 |
| fix | 自作スキル | Function Tool | 開発ワークフロー |
| audit | 自作スキル | Function Tool | 品質管理 |
| explain / explain-deep | 自作スキル | Function Tool | ドキュメント |
| visualize | 自作スキル | Function Tool | ドキュメント |
| devil-advocate | 自作スキル | Function Tool | 分析 |
| webapp-demo-generator | 自作スキル | Function Tool | テスト・デモ |
| design-principles | 自作スキル | Function Tool | デザイン |
| init-docs | 自作スキル | Function Tool | 開発ワークフロー |
| review-pr | 自作スキル | Function Tool | 開発ワークフロー |
| 1-1-create-task | 自作スキル | Function Tool | タスク管理 |
| 1-2-sync_tasks | 自作スキル | Function Tool | タスク管理 |
| 2-design | 自作スキル | Function Tool | 開発ワークフロー |
| 3-implement | 自作スキル | Function Tool | 開発ワークフロー |
| 4-reimplement | 自作スキル | Function Tool | 開発ワークフロー |
| 5-update-pr | 自作スキル | Function Tool | 開発ワークフロー |
| 6-push-pr | 自作スキル | Function Tool | 開発ワークフロー |
| backward-commit | 自作スキル | Function Tool | 開発ワークフロー |
| loop | 自作スキル | Function Tool | 自動化 |
| simplify | 自作スキル | Function Tool | 品質管理 |
| pptx (document-skills) | 公式プラグイン | Built-in Tool | 資料作成 |
| docx (document-skills) | 公式プラグイン | Built-in Tool | 資料作成 |
| xlsx (document-skills) | 公式プラグイン | Built-in Tool | 資料作成 |
| pdf (document-skills) | 公式プラグイン | Built-in Tool | 資料作成 |
| frontend-design | 公式プラグイン | Built-in Tool | デザイン |
| canvas-design | 公式プラグイン | Built-in Tool | デザイン |
| algorithmic-art | 公式プラグイン | Built-in Tool | デザイン |
| brand-guidelines | 公式プラグイン | Built-in Tool | デザイン |
| mcp-builder | 公式プラグイン | Built-in Tool | 開発ワークフロー |
| skill-creator | 公式プラグイン | Built-in Tool | 開発ワークフロー |
| doc-coauthoring | 公式プラグイン | Built-in Tool | ドキュメント |
| internal-comms | 公式プラグイン | Built-in Tool | コミュニケーション |
| webapp-testing | 公式プラグイン | Built-in Tool | テスト・デモ |
| slack-gif-creator | 公式プラグイン | Built-in Tool | コミュニケーション |
| web-artifacts-builder | 公式プラグイン | Built-in Tool | デザイン |
| theme-factory | 公式プラグイン | Built-in Tool | デザイン |
| pr-review-toolkit | 公式プラグイン | Built-in Tool | 品質管理 |
| code-review | 公式プラグイン | Built-in Tool | 品質管理 |
| commit-commands | 公式プラグイン | Built-in Tool | 開発ワークフロー |
| claude-api | 公式プラグイン | Built-in Tool | 開発ワークフロー |
| context7 | 公式プラグイン | MCP Tool | リサーチ |
| serena | 公式プラグイン | MCP Tool | 開発ワークフロー |
| supabase | 公式プラグイン | MCP Tool | データ管理 |
| github | 公式プラグイン | MCP Tool | 開発ワークフロー |

## 提案: カテゴリ体系

| カテゴリ | 含まれるスキル数 | 説明 |
|---------|----------------|------|
| 開発ワークフロー | 15 | 設計→実装→PR→コミットの開発フロー |
| 資料作成 | 6 | PPTX/DOCX/XLSX/PDF生成 |
| デザイン | 6 | UI/ビジュアル/ブランド |
| 品質管理 | 4 | レビュー・監査・簡素化 |
| 組織管理 | 3 | company/permission/invoice |
| ドキュメント | 3 | 説明・可視化・共同執筆 |
| タスク管理 | 2 | タスク作成・同期 |
| テスト・デモ | 2 | Webアプリテスト・デモ動画 |
| コミュニケーション | 2 | Slack GIF・社内コミュ |
| リサーチ | 1 | ドキュメント検索(context7) |
| データ管理 | 1 | Supabase |
| 分析 | 1 | 反論・盲点分析 |
| モード切替 | 1 | no-edit |
| 自動化 | 1 | loop |

## 次のステップへの申し送り

- 開発ワークフロー系が15個と最多。番号付き(1-1, 2, 3, 4, 5, 6)のシリーズは統合や整理の余地あり
- 自作スキルと公式プラグインの重複（pptx系、review系）は使い分けルールを明確にすべき
- MCP Toolは4つ。今後増える可能性が高い
