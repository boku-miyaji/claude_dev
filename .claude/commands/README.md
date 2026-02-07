# Claude Commands

このディレクトリには、Claude Code で使用できるスラッシュコマンド (slash commands) が定義されています。

## 利用可能なコマンド

### ドキュメント管理

#### `/init-docs` - ドキュメント雛形作成

新しいリポジトリ作成時に、標準的な `docs/` ディレクトリ構造と各セクションのREADMEを自動生成します。

**使用例:**
```bash
/init-docs my-project
```

**引数:**
- `project-name` (オプション): プロジェクト名。省略時は現在のディレクトリ名を使用

**生成される構造:**
```
docs/
├── README.md
├── 00-specifications/
├── 01-getting-started/
├── 02-architecture/
├── 03-features/
├── 04-api-reference/
├── 05-external-services/
├── 06-deployment/
├── 07-contributing/
└── 08-security/
```

---

### タスク管理ワークフロー

#### `/1-1-create-task` - タスク作成

ローカルタスクファイル (`tasks/LOCAL_*.yaml`) を作成します。

**使用例:**
```bash
/1-1-create-task
```

**出力:** `tasks/LOCAL_<timestamp>.yaml`

---

#### `/1-2-sync_tasks` - GitHub 同期

ローカルタスクファイルと GitHub Issues を双方向同期します。

**使用例:**
```bash
# GitHub から全Issue を取得してローカルに保存
/1-2-sync_tasks pull

# ローカルのドラフトタスクを GitHub Issue として作成
/1-2-sync_tasks push
```

**引数:**
- `pull`: GitHub → ローカル
- `push`: ローカル → GitHub

---

#### `/2-design` - 設計書作成

Issue ID を指定して、設計ドキュメント (Markdown) を作成します。

**使用例:**
```bash
/2-design 123
```

**引数:**
- `issue-id`: GitHub Issue ID

**出力:** 設計ドキュメント (Markdown)

---

#### `/3-implement` - 実装

設計ドキュメントに基づいて実装を行います。

**使用例:**
```bash
/3-implement 123
```

**引数:**
- `issue-id`: GitHub Issue ID

**実行内容:**
- 機能ブランチ作成
- コード実装
- テスト実行
- コミット
- PR準備

---

#### `/4-reimplement` - 再実装

実装指示に基づいて修正・再実装を行います。

**使用例:**
```bash
/4-reimplement 123
```

**引数:**
- `issue-id`: GitHub Issue ID

**実行内容:**
- テスト実行
- 修正実装
- コミット

---

#### `/5-update-pr` - PR更新

設計ドキュメントに基づいた実装の更新を行います。

**使用例:**
```bash
/5-update-pr 123
```

**引数:**
- `issue-id`: GitHub Issue ID

---

#### `/6-push-pr` - PR作成・プッシュ

実装完了後の機能ブランチをプッシュし、PRを作成します。

**使用例:**
```bash
/6-push-pr 123
```

**引数:**
- `issue-id`: GitHub Issue ID

**実行内容:**
- ブランチプッシュ
- PR作成
- マージ可能性チェック
- レビュー準備
- ステータス更新
- (必要に応じて) 自動マージ

---

### 解説・可視化コマンド

#### `/explain` - ファイル/ディレクトリ解説

指定したファイルまたはディレクトリの中身を詳細にわかりやすく説明します。コードの構造・ロジック、ドキュメントの要点を整理して **HTML レポート** として出力します。Mermaid ダイアグラム・コードハイライト・ダークモード対応。

**使用例:**
```bash
# 単一ファイルを解説
/explain src/auth/login.ts

# ディレクトリ全体を解説
/explain src/components/

# 観点を指定して解説
/explain src/api/routes.ts セキュリティの観点で詳しく

# ドキュメントの要点整理
/explain docs/architecture.md
```

**引数:**
- `file-path` (必須): 対象ファイルまたはディレクトリのパス
- 追加指示 (オプション): 説明の観点や深堀りしたいポイント

**出力:** `tasks/explain/explain_{対象名}_{timestamp}.html`

---

#### `/visualize` - Mermaid ダイアグラム生成

指定したファイルまたはディレクトリを Mermaid ダイアグラムで可視化します。依存関係グラフ、クラス図、シーケンス図、フローチャートなどを自動生成し、**HTML レポート** として出力します。ダークモード・タブ切り替え対応。

**使用例:**
```bash
# ディレクトリの依存関係を可視化（自動判定）
/visualize src/services/

# 処理フローを可視化
/visualize src/auth/login.ts flow

# クラス図を生成
/visualize src/models/ class

# API のシーケンス図を生成
/visualize src/api/routes.ts sequence

# ER 図を生成
/visualize prisma/schema.prisma er

# 全種別を包括的に生成
/visualize src/core/ all
```

**引数:**
- `file-path` (必須): 対象ファイルまたはディレクトリのパス
- `diagram-type` (オプション): `deps` / `flow` / `class` / `sequence` / `er` / `state` / `all`

**出力:** `tasks/visualize/visualize_{対象名}_{timestamp}.html`

---

### 分析・レビューコマンド

#### `/devil-advocate` - 反論AI分析

指定したドキュメントやコードに対して、多角的な視点から反論・質問・盲点を分析します。

**使用例:**
```bash
# ドキュメントを分析
/devil-advocate diary/docs/3-ARCHITECTURE.md

# 追加の観点を指定して分析
/devil-advocate diary/docs/3-ARCHITECTURE.md セキュリティ重視で分析してほしい

# ソースコードを分析
/devil-advocate diary/src/lib/api/entries.ts
```

**引数:**
- `file-path` (必須): 分析対象のファイルパス
- 追加指示 (オプション): 特に重視したい分析観点

**分析視点（6つ）:**
1. 技術的妥当性
2. ビジネス・ユーザー視点
3. セキュリティ・リスク
4. 保守性・拡張性
5. 前提・暗黙の仮定（盲点）
6. ステークホルダーからの想定質問

**出力:** `tasks/review/devil_advocate_{ファイル名}_{timestamp}.md`

---

### その他のコマンド

#### `/backward-commit` - コミット取り消し

指定した Issue ID に関連するコミットを元に戻します。

**使用例:**
```bash
/backward-commit 123
```

**引数:**
- `issue-id`: GitHub Issue ID

---

#### `/workflow_overview_review` - ワークフロー全体レビュー

全体のワークフローをレビューします。

**使用例:**
```bash
/workflow_overview_review
```

---

## ワークフロー全体像

```mermaid
graph TD
    A[/1-1-create-task] --> B[tasks/LOCAL_*.yaml 編集]
    B --> C[/1-2-sync_tasks push]
    C --> D[GitHub Issue 作成]
    D --> E[/2-design issue-id]
    E --> F[設計ドキュメント作成]
    F --> G[/3-implement issue-id]
    G --> H[実装 + テスト + コミット]
    H --> I[/6-push-pr issue-id]
    I --> J[PR作成 + レビュー]

    J -->|修正必要| K[/4-reimplement issue-id]
    K --> H

    J -->|OK| L[マージ]
```

## コマンド開発ガイド

新しいコマンドを作成する場合は、以下の構造に従ってください:

```markdown
---
allowed-tools: >
  Bash(command:*),
  Write(*),
  Read(*)
description: |
  コマンドの説明
---

## 引数

$ARGUMENTS

## 実行手順 🤖

### 1. ステップ1

説明

\`\`\`bash
# コマンド例
\`\`\`

### 2. ステップ2

...
```

## 関連リンク

- [CLAUDE.md](./../CLAUDE.md) - プロジェクト全体のルールと規約
- [タスク管理ワークフロー](./workflow_overview_review.md)
