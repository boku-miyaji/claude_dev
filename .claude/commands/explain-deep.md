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
  指定したディレクトリまたはファイル群を、各ドキュメントごとに個別HTMLページとして詳細に解説する。
  index.html + 個別ページのサイト形式で出力し、Mermaidダイアグラムを多用してビジュアル重視で可視化する。
---

## 引数

$ARGUMENTS

- 第1引数: 対象ディレクトリパス（必須）
- 第2引数以降（オプション）: 説明の観点や深堀りしたいポイント

## 実行手順 🤖

### 1. 引数検証と準備

- 第1引数でディレクトリパスを受け取る（必須）
  - ファイルの場合は「このコマンドはディレクトリを対象としています。単一ファイルの解説は `/explain` を使ってください」とガイドする
  - パスが存在しない場合はエラー終了
- `tree` コマンドでディレクトリ構造を取得する
- 配下の全ファイルを列挙し、ドキュメント中心かコード中心かを判別する
  - `.md`, `.txt`, `.rst`, `.adoc` → ドキュメント
  - `.ts`, `.js`, `.py`, `.go`, `.rs`, `.java`, `.rb`, `.sh` → コード
- `date` コマンドでタイムスタンプを取得し、出力ディレクトリを作成する:
  - `tasks/explain-deep/{対象名}_{YYYYMMDD_HHMMSS}/`
  - `{対象名}` はディレクトリ名（パス区切りは `_` に変換）

---

### 2. [ultrathink] 全ファイルの読み込みと分析

配下の **全ファイル** を Read で読み込み、以下を分析する。

#### ドキュメントファイルごとに:
- 目的・役割（5-10文の詳細説明）
- 対象読者
- 重要度（高/中/低）
- セクション構成（全見出しの完全なアウトライン）
- 各セクションの詳細分析:
  - セクション要約
  - キーポイント（重要な記述・数値の引用付き）
  - 定義されている概念・用語
  - 含まれるデータ構造・スキーマ
  - 含まれるフロー・手順
- 意思決定・ADRの一覧
- 他ドキュメントへの参照
- 課題・改善提案

#### コードファイルごとに:
- ファイルの役割・責務
- 依存関係（import/require）
- エクスポート一覧
- 主要な関数・クラス・型（シグネチャ含む）
- 処理フローのステップ
- データの流れ（入力→変換→出力）
- 注目すべきパターン・工夫

#### 横断的に:
- ファイル間の関係マップ
- トピックカバレッジマトリクス
- 推奨読み順
- ギャップ分析（カバーされていないトピック）
- 横断用語集

---

### 3. index.html の生成

以下の **index.html テンプレート** に分析結果を埋め込んで生成する。

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Deep解説 - {対象パス}</title>
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
      max-width: 1100px;
      margin: 0 auto;
      padding: 40px 24px;
    }
    h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 8px; }
    h2 {
      font-size: 1.25rem; font-weight: 600; margin-top: 48px; margin-bottom: 16px;
      padding-bottom: 8px; border-bottom: 2px solid var(--accent);
    }
    h3 { font-size: 1.1rem; font-weight: 600; margin-top: 24px; margin-bottom: 8px; }
    p { margin: 8px 0; }
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
    .badge-high { background: #e8f5e9; color: #2b8a3e; }
    .badge-mid { background: #fff3e0; color: #e67700; }
    .badge-low { background: #fbe9e7; color: #c92a2a; }
    .badge-detail { background: #e8f5e9; color: #2b8a3e; }
    .badge-summary { background: #fff3e0; color: #e67700; }
    .badge-none { background: #fbe9e7; color: #c92a2a; }
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
    .key-point-warn {
      padding: 12px 16px; border-left: 4px solid var(--warning);
      background: #fff8e1; border-radius: 0 var(--radius) var(--radius) 0;
      margin: 8px 0;
    }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }

    /* === index.html 専用スタイル === */
    .doc-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px; margin: 16px 0;
    }
    .doc-link-card {
      background: var(--bg-secondary); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 20px;
      transition: transform 0.15s, box-shadow 0.15s;
      text-decoration: none; color: var(--text); display: block;
    }
    .doc-link-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      text-decoration: none;
    }
    .doc-link-card h3 { margin-top: 0; color: var(--accent); font-size: 1rem; }
    .doc-link-card p { color: var(--text-secondary); font-size: 0.875rem; margin: 8px 0 0; }
    .doc-link-card .card-meta {
      display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap;
    }
    .stat-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 12px; margin: 16px 0;
    }
    .stat-card {
      background: var(--bg-secondary); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 16px; text-align: center;
    }
    .stat-card .stat-value {
      font-size: 1.75rem; font-weight: 700; color: var(--accent);
    }
    .stat-card .stat-label {
      font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;
    }
    @media (prefers-color-scheme: dark) {
      .key-point-warn { background: #2d2a1e; }
      .badge-high { background: #1b3a1b; color: #9ece6a; }
      .badge-mid { background: #2d2a1e; color: #e0af68; }
      .badge-low { background: #2d1b1b; color: #f7768e; }
      .badge-detail { background: #1b3a1b; color: #9ece6a; }
      .badge-summary { background: #2d2a1e; color: #e0af68; }
      .badge-none { background: #2d1b1b; color: #f7768e; }
      .doc-link-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
    }
  </style>
</head>
<body>
  <h1>Deep 解説レポート</h1>
  <div class="meta">
    <div class="meta-item"><strong>対象:</strong>&nbsp;{対象パス}</div>
    <div class="meta-item"><span class="badge">ディレクトリ ({N}ファイル)</span></div>
    <div class="meta-item"><strong>分析日時:</strong>&nbsp;{YYYY-MM-DD HH:MM}</div>
  </div>

  <!-- ===== 統計サマリー ===== -->
  <div class="stat-grid">
    <div class="stat-card">
      <div class="stat-value">{N}</div>
      <div class="stat-label">ファイル数</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">{total-lines}</div>
      <div class="stat-label">総行数</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">{topic-count}</div>
      <div class="stat-label">トピック数</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">{term-count}</div>
      <div class="stat-label">専門用語数</div>
    </div>
  </div>

  <!-- ===== エグゼクティブサマリー ===== -->
  <h2>エグゼクティブサマリー</h2>
  <div class="card">
    <p>{ドキュメント群全体の概要。プロジェクトのスコープ、対象読者、充実度を説明}</p>
  </div>

  <!-- ===== ディレクトリ構造 ===== -->
  <h2>構造</h2>
  <pre><code>{tree 出力}</code></pre>

  <!-- ===== ドキュメント一覧（カード形式のリンク） ===== -->
  <h2>ドキュメント一覧</h2>
  <div class="doc-grid">
    <!-- 各ファイルごとにカードを生成。個別ページへのリンク付き -->
    <a href="{filename}.html" class="doc-link-card">
      <h3>{ファイル名}</h3>
      <p>{一行要約}</p>
      <div class="card-meta">
        <span class="badge badge-high">{重要度}</span>
        <span class="badge">{対象読者}</span>
        <span class="badge">{行数}行</span>
      </div>
    </a>
    <!-- ↑ 全ファイル分を生成 -->
  </div>

  <!-- ===== ドキュメント関係マップ（Mermaid graph — 大きめ） ===== -->
  <h2>ドキュメント関係マップ</h2>
  <p>ドキュメント間の依存・参照関係を可視化しています。クリックして個別ページへ遷移できます。</p>
  <div class="mermaid">
    graph TD
      A["{ファイル1}"] -->|"参照関係"| B["{ファイル2}"]
      B -->|"詳細"| C["{ファイル3}"]
      %% 実際の分析結果で関係をマッピング
      %% 各ノードに色を付けて見やすくする
      style A fill:#e8eaf6,stroke:#3f51b5
      style B fill:#fce4ec,stroke:#e91e63
  </div>

  <!-- ===== 推奨読み順（Mermaid flowchart） ===== -->
  <h2>推奨読み順</h2>
  <p>初めて読む人にとって最適な読み順をフローチャートで示します。</p>
  <div class="mermaid">
    flowchart LR
      S1["{ステップ1ファイル}"] --> S2["{ステップ2ファイル}"]
      S2 --> S3["{ステップ3ファイル}"]
      %% 全ファイルの推奨読み順をフローで表現
  </div>

  <!-- ===== トピックカバレッジ ===== -->
  <h2>トピックカバレッジ</h2>
  <table>
    <thead><tr><th>トピック</th><th>カバーしているドキュメント</th><th>詳しさ</th></tr></thead>
    <tbody>
      <tr><td>{トピック}</td><td><code>{ファイル名}</code></td><td><span class="badge badge-detail">{詳細/概要/未記載}</span></td></tr>
    </tbody>
  </table>

  <!-- ===== ギャップ分析 ===== -->
  <h2>ギャップ分析</h2>
  <p>一般的なドキュメントとして期待される項目のうち、まだ文書化されていない・記述が薄いトピックです。</p>
  <div class="key-point-warn">
    <strong>{不足トピック1}</strong> — {説明}
  </div>
  <!-- 複数の警告カードを並べる -->

  <!-- ===== 横断用語集 ===== -->
  <h2>横断用語集</h2>
  <table>
    <thead><tr><th>用語</th><th>定義</th><th>初出</th></tr></thead>
    <tbody>
      <tr><td><strong>{用語}</strong></td><td>{定義}</td><td><a href="{filename}.html"><code>{ファイル名}</code></a></td></tr>
    </tbody>
  </table>

  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default'
    });
    hljs.highlightAll();
  </script>
</body>
</html>
```

---

### 4. [ultrathink] 個別ドキュメントページの生成

各ファイルについて、以下の **個別ページテンプレート** に分析結果を埋め込んで生成する。
ファイル名: `{ファイル名（拡張子なし）}.html`（例: `1-README.html`, `3-ARCHITECTURE.html`）

**ビジュアル重視方針（必ず守ること）:**
- **Mermaid 図は最低3つ/ページ**: ドキュメント構造マップ、フロー/関係図、横断参照マップ
- ドキュメント内にデータモデル・スキーマがあれば **Mermaid ER図/classDiagram** で可視化
- ドキュメント内にフロー・手順があれば **Mermaid flowchart/sequence** で可視化
- 意思決定・ADRがあれば **テーブル + ステータスバッジ** で一覧化
- 統計情報は **stat-grid カード** で表示
- テキストの壁を避け、図・カード・バッジ・テーブルを多用する

#### 4A. ドキュメントファイル用テンプレート

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{ファイル名} - Deep解説</title>
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
      max-width: 1000px;
      margin: 0 auto;
      padding: 40px 24px;
    }
    h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 8px; }
    h2 {
      font-size: 1.25rem; font-weight: 600; margin-top: 48px; margin-bottom: 16px;
      padding-bottom: 8px; border-bottom: 2px solid var(--accent);
    }
    h3 { font-size: 1.1rem; font-weight: 600; margin-top: 24px; margin-bottom: 8px; }
    h4 { font-size: 1rem; font-weight: 600; margin-top: 16px; margin-bottom: 4px; }
    p { margin: 8px 0; }
    .breadcrumb {
      font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 16px;
    }
    .breadcrumb a { color: var(--accent); }
    .page-nav {
      display: flex; justify-content: space-between; align-items: center;
      padding: 16px 0; margin-top: 48px;
      border-top: 1px solid var(--border);
      font-size: 0.9rem;
    }
    .page-nav a { color: var(--accent); }
    .page-nav .prev::before { content: "← "; }
    .page-nav .next::after { content: " →"; }
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
    .badge-high { background: #e8f5e9; color: #2b8a3e; }
    .badge-mid { background: #fff3e0; color: #e67700; }
    .badge-low { background: #fbe9e7; color: #c92a2a; }
    .badge-status-accepted { background: #e8f5e9; color: #2b8a3e; }
    .badge-status-proposed { background: #fff3e0; color: #e67700; }
    .badge-status-deprecated { background: #fbe9e7; color: #c92a2a; }
    .card {
      background: var(--bg-secondary); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 20px; margin: 16px 0;
    }
    .stat-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 12px; margin: 16px 0;
    }
    .stat-card {
      background: var(--bg-secondary); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 16px; text-align: center;
    }
    .stat-card .stat-value {
      font-size: 1.5rem; font-weight: 700; color: var(--accent);
    }
    .stat-card .stat-label {
      font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px;
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
    .key-point {
      padding: 12px 16px; border-left: 4px solid var(--accent);
      background: var(--accent-light); border-radius: 0 var(--radius) var(--radius) 0;
      margin: 8px 0;
    }
    .key-point-warn {
      padding: 12px 16px; border-left: 4px solid var(--warning);
      background: #fff8e1; border-radius: 0 var(--radius) var(--radius) 0;
      margin: 8px 0;
    }
    .key-point-success {
      padding: 12px 16px; border-left: 4px solid var(--success);
      background: #e8f5e9; border-radius: 0 var(--radius) var(--radius) 0;
      margin: 8px 0;
    }
    .quote {
      padding: 12px 16px; border-left: 4px solid var(--border);
      background: var(--bg-secondary); border-radius: 0 var(--radius) var(--radius) 0;
      margin: 8px 0; font-style: italic; color: var(--text-secondary);
    }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    @media (prefers-color-scheme: dark) {
      .key-point-warn { background: #2d2a1e; }
      .key-point-success { background: #1b3a1b; }
      .badge-high, .badge-status-accepted { background: #1b3a1b; color: #9ece6a; }
      .badge-mid, .badge-status-proposed { background: #2d2a1e; color: #e0af68; }
      .badge-low, .badge-status-deprecated { background: #2d1b1b; color: #f7768e; }
    }
  </style>
</head>
<body>
  <!-- パンくずナビ -->
  <div class="breadcrumb">
    <a href="index.html">Deep解説 トップ</a> &gt; <strong>{ファイル名}</strong>
  </div>

  <h1>{ファイル名}</h1>
  <div class="meta">
    <div class="meta-item"><span class="badge badge-high">{重要度}</span></div>
    <div class="meta-item"><span class="badge">{対象読者}</span></div>
    <div class="meta-item"><strong>行数:</strong>&nbsp;{行数}</div>
  </div>

  <!-- ===== 統計情報カード ===== -->
  <div class="stat-grid">
    <div class="stat-card">
      <div class="stat-value">{行数}</div>
      <div class="stat-label">行数</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">{セクション数}</div>
      <div class="stat-label">セクション</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">{用語数}</div>
      <div class="stat-label">定義用語</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">{参照先数}</div>
      <div class="stat-label">他文書参照</div>
    </div>
  </div>

  <!-- ===== サマリー ===== -->
  <h2>サマリー</h2>
  <div class="card">
    <p>{このドキュメントの目的・役割を5-10文で詳細に説明}</p>
  </div>

  <!-- ===== ドキュメント構造マップ（Mermaid mindmap） ===== -->
  <!-- ★ ビジュアル重視: セクション構成をマインドマップで俯瞰 -->
  <h2>ドキュメント構造マップ</h2>
  <div class="mermaid">
    mindmap
      root(({ファイル名}))
        セクション1
          サブセクション1-1
          サブセクション1-2
        セクション2
          サブセクション2-1
        セクション3
  </div>

  <!-- ===== セクション別詳細解説 ===== -->
  <h2>セクション別詳細解説</h2>
  <p>各セクションの内容を展開して詳細を確認できます。</p>

  <!-- 各セクションを details で展開可能にする -->
  <details>
    <summary>{セクション見出し}</summary>
    <div>
      <p>{セクションの要約（3-5文）}</p>

      <h4>キーポイント</h4>
      <div class="key-point">
        <strong>{重要ポイント1}</strong> — {説明}
      </div>
      <div class="key-point">
        <strong>{重要ポイント2}</strong> — {説明}
      </div>

      <!-- 重要な引用があれば -->
      <h4>注目すべき記述</h4>
      <div class="quote">{ドキュメントからの重要な引用や数値}</div>

      <!-- データ構造・スキーマがあれば -->
      <h4>データ構造</h4>
      <pre><code class="language-typescript">{コードブロック}</code></pre>

      <!-- 用語定義があれば -->
      <h4>このセクションで定義されている用語</h4>
      <ul>
        <li><strong>{用語}</strong>: {定義}</li>
      </ul>
    </div>
  </details>
  <!-- ↑ 全セクション分繰り返す -->

  <!-- ===== 意思決定・ADR（ドキュメント内に設計判断がある場合） ===== -->
  <!-- ★ ビジュアル重視: ステータスバッジ付きテーブル -->
  <h2>意思決定・設計判断</h2>
  <p>このドキュメント内に記録されている設計判断の一覧です。</p>
  <table>
    <thead><tr><th>ID</th><th>タイトル</th><th>ステータス</th><th>概要</th></tr></thead>
    <tbody>
      <tr>
        <td><code>{ADR-ID}</code></td>
        <td>{タイトル}</td>
        <td><span class="badge badge-status-accepted">{ステータス}</span></td>
        <td>{一行概要}</td>
      </tr>
    </tbody>
  </table>
  <!-- ※ ADR/設計判断がないドキュメントではこのセクションを省略する -->

  <!-- ===== データモデル・スキーマ（Mermaid ER図 or classDiagram） ===== -->
  <!-- ★ ビジュアル重視: ドキュメント内のデータ構造を図で可視化 -->
  <h2>データモデル・スキーマ</h2>
  <p>このドキュメントで定義・参照されているデータ構造を可視化しています。</p>
  <div class="mermaid">
    erDiagram
      %% ドキュメント内のデータモデルを ER図で表現
      EntityA {
        string id PK
        string name
      }
      EntityB {
        string id PK
        string entity_a_id FK
      }
      EntityA ||--o{ EntityB : "has"
  </div>
  <!-- ※ データモデルがないドキュメントでは省略 -->

  <!-- ===== フロー・手順（Mermaid flowchart or sequence） ===== -->
  <!-- ★ ビジュアル重視: ドキュメント内のフローを図で表現 -->
  <h2>フロー・プロセス</h2>
  <p>このドキュメントで説明されているフローやプロセスを可視化しています。</p>
  <div class="mermaid">
    flowchart TD
      A["{ステップ1}"] --> B["{ステップ2}"]
      B --> C{"{判断}"}
      C -->|Yes| D["{処理A}"]
      C -->|No| E["{処理B}"]
  </div>
  <!-- ※ フロー・手順がないドキュメントでは省略 -->

  <!-- ===== 横断参照マップ（Mermaid graph） ===== -->
  <!-- ★ ビジュアル重視: このドキュメントと他ドキュメントの関係図 -->
  <h2>横断参照マップ</h2>
  <p>このドキュメントが参照している、またはこのドキュメントを参照している他のドキュメントとの関係です。</p>
  <div class="mermaid">
    graph LR
      THIS["{このファイル名}"]
      REF1["{参照先1}"]
      REF2["{参照先2}"]
      FROM1["{参照元1}"]

      THIS -->|"参照"| REF1
      THIS -->|"参照"| REF2
      FROM1 -->|"参照"| THIS

      style THIS fill:#e8eaf6,stroke:#3f51b5,stroke-width:3px
  </div>

  <!-- ===== 用語集 ===== -->
  <h2>用語集</h2>
  <table>
    <thead><tr><th>用語</th><th>定義</th></tr></thead>
    <tbody>
      <tr><td><strong>{用語}</strong></td><td>{定義}</td></tr>
    </tbody>
  </table>

  <!-- ===== 課題・改善提案 ===== -->
  <h2>課題・改善提案</h2>
  <div class="key-point-warn">
    <strong>{課題1}</strong> — {説明}
  </div>
  <div class="key-point-success">
    <strong>{良い点1}</strong> — {説明}
  </div>

  <!-- ===== 前後ナビゲーション ===== -->
  <div class="page-nav">
    <a href="{prev-file}.html" class="prev">{前のドキュメント名}</a>
    <a href="index.html">トップに戻る</a>
    <a href="{next-file}.html" class="next">{次のドキュメント名}</a>
  </div>

  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default'
    });
    hljs.highlightAll();
  </script>
</body>
</html>
```

#### 4B. コードファイル用テンプレート

コードファイルの場合は以下のセクション構成に変更する（HTMLの枠組み・CSS・ナビゲーションは 4A と同じ）:

1. **パンくずナビ**: index.html > 現在のファイル
2. **統計カード**: 行数、関数/クラス数、import数、export数
3. **サマリー**: ファイルの役割・責務（5-10文）
4. **モジュール構造マップ（Mermaid classDiagram）**: クラス・関数・型の関係を図で可視化
5. **依存関係グラフ（Mermaid graph）**: import/require の関係図（各モジュールの役割付き）
6. **エクスポート一覧**: 外部に公開している関数・クラス・型のテーブル
7. **関数・クラス詳細**: 各関数/クラスごとに `<details>` で展開
   - シグネチャ（引数、戻り値の型）
   - 責務の説明
   - 処理フローのステップ
8. **処理フロー（Mermaid flowchart）**: 主要ロジックのフローチャート
9. **データフロー（Mermaid sequence diagram）**: 入力→変換→出力のパイプライン
10. **キーポイント**: 複雑なロジック、パフォーマンスの工夫
11. **横断参照マップ（Mermaid graph）**: このファイルと他ファイルの関係図
12. **前後ナビゲーション**

---

### 5. HTML 生成のルール

- **テンプレートの `{...}` 部分を実際の分析結果で置換する**
- Mermaid 図は `<div class="mermaid">` タグ内に記述する（コードフェンス不要）
- コードブロックは `<pre><code class="language-xxx">` を使用する
- ダークモード対応済み（CSS の `prefers-color-scheme` + Mermaid のテーマ自動切替）
- **ページ間リンクは相対パス**（同一ディレクトリ内のファイル同士）
- 不要なセクションは省略してよい:
  - ADR/設計判断がないドキュメントでは「意思決定」セクション省略
  - データモデルがないドキュメントでは「データモデル」セクション省略
  - フローがないドキュメントでは「フロー」セクション省略
- **ただし以下は必ず含めること:**
  - Mermaid 図を最低3つ（構造マップ、何らかのフロー/関係図、横断参照マップ）
  - 統計カード
  - セクション別詳細解説
  - 用語集
  - 前後ナビゲーション

---

### 6. 完了ログ出力

- 生成したディレクトリパスを表示
- 生成されたファイル一覧を表示（index.html + 個別ページ数）
- 対象の概要サマリーを 3 行以内で表示
- 「ブラウザで index.html を開いて確認してください」と案内

## 使用例

```bash
# ドキュメントディレクトリを詳細解説
/explain-deep docs/

# コードディレクトリを詳細解説
/explain-deep src/components/

# 観点を指定して詳細解説
/explain-deep diary/docs/ AI機能とUX設計に焦点を当てて
```
