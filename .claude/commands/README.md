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

#### `/explain-deep` - ディレクトリ詳細解説（マルチページ）

指定したディレクトリを、各ドキュメント/ファイルごとに **個別HTMLページ** として詳細に解説します。index.html + 個別ページのサイト形式で出力し、**Mermaid ダイアグラムを多用**してビジュアル重視で可視化します。

`/explain` がサマリーなら、`/explain-deep` は各ドキュメントの教科書です。

**使用例:**
```bash
# ドキュメントディレクトリを詳細解説
/explain-deep docs/

# コードディレクトリを詳細解説
/explain-deep src/components/

# 観点を指定して詳細解説
/explain-deep diary/docs/ AI機能とUX設計に焦点を当てて
```

**引数:**
- `directory-path` (必須): 対象ディレクトリのパス
- 追加指示 (オプション): 説明の観点や深堀りしたいポイント

**出力:** `tasks/explain-deep/{対象名}_{timestamp}/index.html` + 個別ページ群

**個別ページの内容（ドキュメントの場合）:**
- 統計カード（行数、セクション数、用語数、参照数）
- ドキュメント構造マインドマップ（Mermaid mindmap）
- セクション別詳細解説（展開可能）
- 意思決定・ADR テーブル
- データモデル ER図（Mermaid）
- フロー・プロセス図（Mermaid）
- 横断参照マップ（Mermaid）
- 用語集、課題・改善提案
- 前後ページナビゲーション

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

#### `/audit` - 構造・整合性監査

指定したディレクトリのドキュメント構造・コード構造・内容の整合性をチェックし、修正方針を提示します。ドキュメントの場合は prefix 番号が小さいほど上流（抽象度が高い）になるよう整理します。修正はユーザーが承認した項目のみ実行します。

**フロー:** 監査・分析 → 修正方針の提示（ここで停止） → ユーザー承認後に修正実行

**使用例:**
```bash
# ドキュメントディレクトリを監査
/audit diary/docs/

# コードディレクトリを監査
/audit src/lib/

# 観点を指定して監査
/audit diary/docs/ セキュリティドキュメントの充実度を重点チェック
```

**引数:**
- `directory-path` (必須): 対象ディレクトリのパス
- 追加指示 (オプション): 重点チェックしたい観点

**監査項目（ドキュメント）:**
1. Prefix 番号と上流・下流の整合性
2. 相互参照の整合性（壊れたリンク検出）
3. 内容の重複・矛盾
4. 冗長性分析（ファイル間重複 / ファイル内重複 / 情報密度低 / 冗長表現）
5. 用語の統一性
6. カバレッジ・ギャップ分析
7. TODO / FIXME / 空セクション検出
8. フォーマット一貫性

**監査項目（コード）:**
1. ディレクトリ構成・命名規則
2. Import / 依存関係（循環 import 等）
3. Export / API 整合性
4. コード冗長性（重複コード / 共通化可能 / Dead code）
5. パターン一貫性
6. コード ↔ ドキュメント同期

**出力:** `tasks/audit/audit_{対象名}_{timestamp}.html`

---

### その他のコマンド

#### `/fix` - バグ修正・機能修正

バグや機能不具合の修正を、**原因調査→ドキュメント更新→実装修正→再発防止**の一連フローで実行します。修正前にドキュメントを更新することで、同じミスの繰り返しを防ぎます。

**使用例:**
```bash
# バグの症状を説明
/fix ログイン画面でメールアドレスのバリデーションが効いていない

# 機能修正の内容を説明
/fix 日記一覧のソート順が作成日時ではなく更新日時になっている

# 詳細な指示
/fix APIレスポンスのページネーションで最終ページの件数が正しくない。totalCountは正しいがitemsが重複している
```

**引数:**
- `修正指示` (必須): バグの症状や修正したい内容の説明

**実行フロー:**
1. 原因調査（Root Cause Analysis）
2. 原因調査ドキュメント作成 → `tasks/fix/{timestamp}_{slug}_analysis.md`
3. 要件定義・設計ドキュメントの更新
4. 実装修正 + 回帰テスト作成
5. 再発防止ドキュメント作成 → `tasks/fix/{timestamp}_{slug}_lessons_learned.md`
6. コミット

**出力ドキュメント:**
- `tasks/fix/{timestamp}_{slug}_analysis.md` - 原因調査レポート
- `tasks/fix/{timestamp}_{slug}_lessons_learned.md` - 再発防止レポート（チェックリスト付き）
- 更新された設計ドキュメント

---

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

    F -.->|品質チェック| M[/audit docs/]
    H -.->|品質チェック| N[/audit src/]

    L -->|バグ発見| O[/fix 症状説明]
    O --> P[原因調査 + ドキュメント更新]
    P --> Q[実装修正 + 回帰テスト]
    Q --> R[再発防止レポート作成]
    R --> I

    style O fill:#ff6b6b,color:#fff
    style P fill:#ffa94d,color:#fff
    style Q fill:#51cf66,color:#fff
    style R fill:#339af0,color:#fff
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
