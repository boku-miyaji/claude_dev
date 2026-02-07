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
  指定したファイルまたはディレクトリを Mermaid ダイアグラムで可視化する。
  依存関係グラフ、クラス図、シーケンス図、フローチャートなどを自動生成し、HTMLで出力する。
---

## 引数

$ARGUMENTS

- 第1引数: 対象ファイルパスまたはディレクトリパス（必須）
- 第2引数以降（オプション）: ダイアグラム種別の指定や追加コンテキスト

## ダイアグラム種別キーワード（第2引数で指定可能）

| キーワード | 説明 | 適用場面 |
|-----------|------|---------|
| `deps` | 依存関係グラフ（デフォルト） | ファイル間・モジュール間の参照関係 |
| `flow` | フローチャート | 関数や処理の実行フロー |
| `class` | クラス図 | クラス/インターフェースの継承・実装関係 |
| `sequence` | シーケンス図 | API呼び出しやモジュール間のやりとり |
| `er` | ER図 | データモデル・テーブル関係 |
| `state` | 状態遷移図 | ステートマシンやライフサイクル |
| `all` | 全種別を可能な範囲で生成 | 包括的な可視化 |

指定がない場合は、対象の内容に最適なダイアグラム種別を自動判定する。

## 実行手順 🤖

### 1. 引数検証と対象の判別

- 第1引数でファイルまたはディレクトリのパスを受け取る（必須）
  - パスが存在しない場合はエラー終了
- ファイルかディレクトリかを判別する
- 第2引数でダイアグラム種別が指定されていればそれを使用
- 指定がなければ対象の内容から最適な種別を自動判定する

### 2. [ultrathink] 対象の読み込みと構造分析

#### ファイルの場合

- ファイルの内容を Read で読み込む
- 以下を抽出・分析:
  - import/export 文
  - クラス、インターフェース、型定義
  - 関数定義とその呼び出し関係
  - 条件分岐、ループ等の制御フロー
  - 外部API呼び出し
  - データモデル定義（ORM, Schema 等）

#### ディレクトリの場合

- `tree` でディレクトリ構造を取得
- 主要ファイル（エントリポイント、設定、テスト等）を特定
- 各ファイルの import/export を解析してファイル間の依存関係を構築
- Glob で `**/*.ts`, `**/*.js`, `**/*.py` 等のパターンで全ファイルを列挙
- 重要度の高いファイルから優先的に読み込む

### 3. [ultrathink] Mermaid ダイアグラムの生成

種別に応じてダイアグラムを生成する。各種別の Mermaid 構文例:

#### deps（依存関係グラフ）
```
graph LR
    subgraph Core
        A[index.ts]
        B[types.ts]
    end
    subgraph Services
        C[auth.ts]
        D[api.ts]
    end
    A --> B
    A --> C
    C --> D
```

#### flow（フローチャート）
```
flowchart TD
    A[リクエスト受信] --> B{認証チェック}
    B -->|認証済み| C[データ取得]
    B -->|未認証| D[401 エラー]
```

#### class（クラス図）
```
classDiagram
    class UserService {
        -repository: UserRepository
        +findById(id) User
        +create(data) User
    }
    UserService --> UserRepository
```

#### sequence（シーケンス図）
```
sequenceDiagram
    participant Client
    participant API
    participant DB
    Client->>API: POST /users
    API->>DB: INSERT
    DB-->>API: User
    API-->>Client: 201 Created
```

#### er（ER図）
```
erDiagram
    USER ||--o{ POST : "has many"
    USER { string id PK; string email }
    POST { string id PK; string user_id FK }
```

#### state（状態遷移図）
```
stateDiagram-v2
    [*] --> Draft
    Draft --> Review : submit
    Review --> Approved : approve
    Approved --> Published : publish
```

### 4. HTML レポートファイル生成

出力先: `tasks/visualize/` ディレクトリ（なければ作成）

ファイル名: `tasks/visualize/visualize_{対象名}_{YYYYMMDD_HHMMSS}.html`

以下の HTML テンプレートに分析結果を埋め込んで生成する。
Mermaid.js CDN を使い、ブラウザで開くだけでダイアグラムがレンダリングされるようにする。

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>可視化レポート - {対象パス}</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
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
    .diagram-container {
      background: var(--bg-secondary); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 32px 16px; margin: 24px 0;
      text-align: center; overflow-x: auto;
    }
    .diagram-container .mermaid { display: inline-block; text-align: center; }
    table {
      width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 0.9rem;
    }
    th, td {
      padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--border);
    }
    th { background: var(--bg-secondary); font-weight: 600; white-space: nowrap; }
    tr:hover td { background: var(--bg-secondary); }
    code {
      font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 0.875rem;
      background: var(--bg-code); padding: 2px 6px; border-radius: 4px;
    }
    .legend {
      display: flex; flex-wrap: wrap; gap: 16px; padding: 12px 16px;
      background: var(--bg-secondary); border: 1px solid var(--border);
      border-radius: var(--radius); margin: 12px 0; font-size: 0.85rem;
    }
    .legend-item { display: flex; align-items: center; gap: 6px; }
    .legend-color {
      width: 14px; height: 14px; border-radius: 3px; border: 1px solid var(--border);
    }
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
    ul { padding-left: 24px; margin: 8px 0; }
    li { margin: 4px 0; }
    .key-point {
      padding: 12px 16px; border-left: 4px solid var(--accent);
      background: var(--accent-light); border-radius: 0 var(--radius) var(--radius) 0;
      margin: 8px 0;
    }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .tab-container { margin: 24px 0; }
    .tab-buttons { display: flex; gap: 0; border-bottom: 2px solid var(--border); }
    .tab-btn {
      padding: 10px 20px; cursor: pointer; font-weight: 600; font-size: 0.9rem;
      background: none; border: none; color: var(--text-secondary);
      border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.2s;
    }
    .tab-btn:hover { color: var(--accent); }
    .tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); }
    .tab-content { display: none; padding: 24px 0; }
    .tab-content.active { display: block; }
  </style>
</head>
<body>
  <h1>可視化レポート</h1>
  <div class="meta">
    <div class="meta-item"><strong>対象:</strong>&nbsp;{対象パス}</div>
    <div class="meta-item"><span class="badge">{ファイル or ディレクトリ}</span></div>
    <div class="meta-item"><span class="badge">{ダイアグラム種別}</span></div>
    <div class="meta-item"><strong>生成日時:</strong>&nbsp;{YYYY-MM-DD HH:MM}</div>
  </div>

  <!-- ▼ 以下に分析結果をセクションごとに埋め込む ▼ -->

  <h2>概要</h2>
  <div class="card">
    <p>{対象の簡潔な説明（2-3文）}</p>
  </div>

  <h2>ダイアグラム</h2>

  <!-- === 単一ダイアグラムの場合 === -->
  <div class="diagram-container">
    <div class="mermaid">
      {Mermaid記法のダイアグラム}
    </div>
  </div>

  <!-- === all 指定で複数ダイアグラムの場合はタブ切り替え === -->
  <!--
  <div class="tab-container">
    <div class="tab-buttons">
      <button class="tab-btn active" onclick="switchTab('deps')">依存関係</button>
      <button class="tab-btn" onclick="switchTab('flow')">フロー</button>
      <button class="tab-btn" onclick="switchTab('class')">クラス図</button>
    </div>
    <div id="tab-deps" class="tab-content active">
      <div class="diagram-container">
        <div class="mermaid">{deps diagram}</div>
      </div>
    </div>
    <div id="tab-flow" class="tab-content">
      <div class="diagram-container">
        <div class="mermaid">{flow diagram}</div>
      </div>
    </div>
    <div id="tab-class" class="tab-content">
      <div class="diagram-container">
        <div class="mermaid">{class diagram}</div>
      </div>
    </div>
  </div>
  -->

  <h3>凡例</h3>
  <div class="legend">
    <div class="legend-item">
      <div class="legend-color" style="background: #364fc7;"></div>
      <span>{凡例項目の説明}</span>
    </div>
    <!-- 凡例を動的生成 -->
  </div>

  <h2>補足説明</h2>

  <h3>主要コンポーネント</h3>
  <table>
    <thead><tr><th>コンポーネント</th><th>役割</th><th>補足</th></tr></thead>
    <tbody>
      <!-- 行を動的生成 -->
    </tbody>
  </table>

  <h3>注目すべきポイント</h3>
  <div class="key-point">{注目ポイントの説明}</div>

  <h2>関連ファイル</h2>
  <ul>
    <li><code>{path}</code> - {説明}</li>
  </ul>

  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default',
      flowchart: { useMaxWidth: true, htmlLabels: true },
      sequence: { useMaxWidth: true },
      er: { useMaxWidth: true }
    });

    // タブ切り替え（all 指定時のみ使用）
    function switchTab(tabId) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      document.querySelector(`[onclick="switchTab('${tabId}')"]`).classList.add('active');
      document.getElementById('tab-' + tabId).classList.add('active');
    }
  </script>
</body>
</html>
```

**HTML 生成のルール:**

- 上記テンプレートの `{...}` 部分を実際の分析結果で置換する
- Mermaid 図は `<div class="mermaid">` タグ内に記述する（コードフェンス不要）
- `all` 指定時はタブ UI を使い、複数ダイアグラムを切り替え表示する
- ダークモードでは Mermaid テーマも `dark` に自動切替
- 不要なセクションは省略してよい
- `diagram-container` の中にダイアグラムを配置してスクロール対応にする

### 5. 完了ログ出力

- 生成した HTML レポートファイルパスを表示
- 生成したダイアグラムの種別と要素数を表示
- 「ブラウザで HTML ファイルを開いてダイアグラムを確認してください」と案内

## 使用例

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
