---
allowed-tools: >
  Bash(wc:*),
  Bash(file:*),
  Bash(tree:*),
  Bash(ls:*),
  Bash(date:*),
  Bash(mkdir:*),
  Bash(open:*),
  Read(*),
  Write(*),
  Glob(*),
  Grep(*)
description: |
  指定したファイルまたはディレクトリの中身を詳細にわかりやすく説明する。
  コードの構造・ロジック、ドキュメントの要点を整理してHTMLレポートとして出力する。
---

## 引数

$ARGUMENTS

- 第1引数: 対象ファイルパスまたはディレクトリパス（必須）
- 第2引数以降（オプション）: 説明の観点や深堀りしたいポイント

## 実行手順 🤖

### 1. 引数検証と対象の判別

- 第1引数でファイルまたはディレクトリのパスを受け取る（必須）
  - パスが存在しない場合はエラー終了
- ファイルかディレクトリかを判別し、以下のフローに分岐:
  - **ファイルの場合** → ステップ 2A へ
  - **ディレクトリの場合** → ステップ 2B へ
- 第2引数以降があれば、説明の観点として考慮する

---

### 2A. [ultrathink] 単一ファイルの詳細解析

対象ファイルを Read で読み込み、ファイル種別に応じて以下を分析する。

#### コードファイルの場合（.ts, .js, .py, .go, .rs, .java, .rb, .sh, etc.）

1. **概要**: ファイルの役割・責務を1-2文で説明
2. **依存関係**: import/require しているモジュール一覧と各モジュールの役割
3. **エクスポート**: 外部に公開している関数・クラス・型の一覧
4. **主要な構造**:
   - クラス/関数/型の一覧とそれぞれの責務
   - 引数と戻り値の型・意味
5. **処理フロー**: 主要なロジックの流れをステップバイステップで説明
6. **データの流れ**: 入力 → 変換 → 出力のパイプライン
7. **注目ポイント**: 複雑なロジック、パフォーマンス上の工夫、エラーハンドリング等

#### ドキュメントファイルの場合（.md, .txt, .rst, .adoc, etc.）

1. **概要**: ドキュメントの目的・対象読者を説明
2. **構造**: セクション構成をアウトライン形式で表示
3. **要点まとめ**: 各セクションの重要ポイントを箇条書き
4. **相互参照**: 他ドキュメントやコードへの参照リンク
5. **用語集**: ドキュメント内で使われている重要な専門用語の定義

#### 設定ファイルの場合（.json, .yaml, .yml, .toml, .ini, .env.example, etc.）

1. **概要**: 設定ファイルの目的
2. **設定項目一覧**: 主要な設定項目とその意味・デフォルト値
3. **環境別の差異**: 環境ごとに異なる設定があれば指摘
4. **セキュリティ注意**: シークレットやクレデンシャルに関わる項目

#### データファイルの場合（.csv, .sql, .graphql, etc.）

1. **概要**: データの内容と用途
2. **スキーマ/構造**: カラム定義やフィールド一覧
3. **リレーション**: 他のデータとの関連性

---

### 2B. [ultrathink] ディレクトリの全体解析

対象ディレクトリの構造を `tree` で取得し、主要ファイルを読み込んで分析する。

1. **ディレクトリ概要**: このディレクトリの役割・目的を1-2文で説明
2. **ディレクトリツリー**: ファイル・フォルダ構造を可視化（tree コマンドの出力）
3. **ファイル構成マップ**: 各ファイルの役割を一覧テーブルで表示
4. **依存関係グラフ**: ファイル間の import/参照関係を Mermaid graph で可視化
5. **アーキテクチャパターン**: 検出されたパターン（MVC, Repository, etc.）
6. **エントリポイント**: メインとなるファイルとそこからの実行フロー
7. **主要ファイルの要約**: 重要度の高いファイルについて 2-3 行の説明

---

### 3. HTML レポートファイル生成

出力先: `tasks/explain/` ディレクトリ（なければ作成）

ファイル名: `tasks/explain/explain_{対象名}_{YYYYMMDD_HHMMSS}.html`

- `{対象名}` はファイル名またはディレクトリ名（パス区切りは `_` に変換）

以下の HTML テンプレートに分析結果を埋め込んで生成する。
Mermaid.js CDN と highlight.js CDN を使い、ブラウザで開くだけで図とコードハイライトが表示されるようにする。

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>解説レポート - {対象パス}</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/styles/github.min.css">
  <script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/highlight.min.js"></script>
  <style>
    :root {
      --bg: #ffffff;
      --bg-secondary: #f8f9fa;
      --bg-code: #f1f3f5;
      --text: #1a1a2e;
      --text-secondary: #495057;
      --border: #dee2e6;
      --accent: #364fc7;
      --accent-light: #edf2ff;
      --success: #2b8a3e;
      --warning: #e67700;
      --danger: #c92a2a;
      --radius: 8px;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #1a1b26;
        --bg-secondary: #24283b;
        --bg-code: #1e2030;
        --text: #c0caf5;
        --text-secondary: #9aa5ce;
        --border: #3b4261;
        --accent: #7aa2f7;
        --accent-light: #1e2030;
        --success: #9ece6a;
        --warning: #e0af68;
        --danger: #f7768e;
      }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans JP', sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.7;
      max-width: 960px;
      margin: 0 auto;
      padding: 40px 24px;
    }
    h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 8px; }
    h2 {
      font-size: 1.25rem; font-weight: 600; margin-top: 48px; margin-bottom: 16px;
      padding-bottom: 8px; border-bottom: 2px solid var(--accent);
    }
    h3 { font-size: 1.1rem; font-weight: 600; margin-top: 24px; margin-bottom: 8px; }
    .meta {
      display: flex; flex-wrap: wrap; gap: 16px;
      color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 32px;
    }
    .meta-item { display: flex; align-items: center; gap: 4px; }
    .badge {
      display: inline-block; padding: 2px 10px; border-radius: 12px;
      font-size: 0.75rem; font-weight: 600;
      background: var(--accent-light); color: var(--accent);
    }
    .card {
      background: var(--bg-secondary); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 20px; margin: 16px 0;
    }
    table {
      width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 0.9rem;
    }
    th, td {
      padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--border);
    }
    th { background: var(--bg-secondary); font-weight: 600; white-space: nowrap; }
    tr:hover td { background: var(--bg-secondary); }
    pre {
      background: var(--bg-code); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 16px; overflow-x: auto; margin: 12px 0;
    }
    code { font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 0.875rem; }
    :not(pre) > code {
      background: var(--bg-code); padding: 2px 6px; border-radius: 4px;
    }
    .mermaid { margin: 24px 0; text-align: center; }
    details {
      border: 1px solid var(--border); border-radius: var(--radius);
      margin: 12px 0; overflow: hidden;
    }
    summary {
      padding: 12px 16px; cursor: pointer; font-weight: 600;
      background: var(--bg-secondary); user-select: none;
    }
    summary:hover { background: var(--accent-light); }
    details[open] summary { border-bottom: 1px solid var(--border); }
    details > div { padding: 16px; }
    ul, ol { padding-left: 24px; margin: 8px 0; }
    li { margin: 4px 0; }
    .flow-step {
      display: flex; align-items: flex-start; gap: 12px; margin: 12px 0;
    }
    .flow-step-num {
      flex-shrink: 0; width: 28px; height: 28px; border-radius: 50%;
      background: var(--accent); color: white; display: flex;
      align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700;
    }
    .flow-step-content { flex: 1; }
    .key-point {
      padding: 12px 16px; border-left: 4px solid var(--accent);
      background: var(--accent-light); border-radius: 0 var(--radius) var(--radius) 0;
      margin: 8px 0;
    }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .toc { list-style: none; padding-left: 0; }
    .toc li { padding: 4px 0; }
    .toc a { color: var(--text-secondary); }
    .toc a:hover { color: var(--accent); }
  </style>
</head>
<body>
  <h1>解説レポート</h1>
  <div class="meta">
    <div class="meta-item"><strong>対象:</strong>&nbsp;{対象パス}</div>
    <div class="meta-item"><span class="badge">{ファイル or ディレクトリ}</span></div>
    <div class="meta-item"><strong>分析日時:</strong>&nbsp;{YYYY-MM-DD HH:MM}</div>
  </div>

  <!-- ▼ 以下に分析結果をセクションごとに埋め込む ▼ -->

  <h2>概要</h2>
  <div class="card">
    <p>{対象の役割・目的を簡潔に説明}</p>
  </div>

  <h2>構造</h2>
  <!-- ファイルの場合: 関数/クラス一覧テーブル -->
  <!-- ディレクトリの場合: tree 出力 + ファイルマップテーブル -->
  <pre><code>{tree 出力 or 構造一覧}</code></pre>
  <table>
    <thead><tr><th>要素</th><th>種別</th><th>説明</th></tr></thead>
    <tbody>
      <!-- 行を動的生成 -->
    </tbody>
  </table>

  <h2>詳細解説</h2>
  <!-- ファイル種別に応じた詳細分析結果 -->
  <!-- details/summary で折りたたみにすると見やすい -->
  <details open>
    <summary>{セクション名}</summary>
    <div>{詳細内容}</div>
  </details>

  <h2>依存関係</h2>
  <div class="mermaid">
    graph LR
      A[module-a] --> B[module-b]
  </div>

  <h2>処理フロー</h2>
  <!-- flow-step で番号付きステップ表示 -->
  <div class="flow-step">
    <div class="flow-step-num">1</div>
    <div class="flow-step-content">{ステップの説明}</div>
  </div>
  <!-- or Mermaid flowchart -->
  <div class="mermaid">
    flowchart TD
      A[開始] --> B{条件}
      B -->|Yes| C[処理]
      B -->|No| D[終了]
  </div>

  <h2>キーポイント</h2>
  <div class="key-point">{注目すべき設計判断やパフォーマンス上の工夫}</div>

  <h2>用語・概念</h2>
  <table>
    <thead><tr><th>用語</th><th>説明</th></tr></thead>
    <tbody>
      <!-- 行を動的生成 -->
    </tbody>
  </table>

  <h2>関連ファイル</h2>
  <ul>
    <li><code>{path}</code> - {関連の説明}</li>
  </ul>

  <script>
    mermaid.initialize({ startOnLoad: true, theme: 'default' });
    hljs.highlightAll();
  </script>
</body>
</html>
```

**HTML 生成のルール:**

- 上記テンプレートの `{...}` 部分を実際の分析結果で置換する
- Mermaid 図は `<div class="mermaid">` タグ内に記述する（コードフェンス不要）
- コードブロックは `<pre><code class="language-xxx">` を使用する
- 長い解説は `<details><summary>` で折りたたみにする
- 不要なセクションは省略してよい（例: コードファイルなら「用語集」は不要な場合がある）
- ダークモード対応済み（CSS の `prefers-color-scheme` で自動切替）

### 4. 完了ログ出力

- 生成した HTML レポートファイルパスを表示
- 対象の概要サマリーを 3 行以内で表示
- 「ブラウザで HTML ファイルを開いて確認してください」と案内

## 使用例

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
