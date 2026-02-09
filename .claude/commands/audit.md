---
allowed-tools: >
  Bash(wc:*),
  Bash(file:*),
  Bash(tree:*),
  Bash(ls:*),
  Bash(date:*),
  Bash(mkdir:*),
  Bash(open:*),
  Bash(mv:*),
  Bash(cp:*),
  Bash(git diff:*),
  Bash(git log:*),
  Bash(git status:*),
  Read(*),
  Write(*),
  Edit(*),
  Glob(*),
  Grep(*)
description: |
  指定したディレクトリのドキュメント構造・コード構造・内容の整合性をチェックし、
  修正・最適化を行う。ドキュメントの場合はprefix番号が小さい方がより上流になるよう整理する。
---

## 引数

$ARGUMENTS

- 第1引数: 対象ディレクトリパス（必須）
- 第2引数以降（オプション）: `--fix`（自動修正を実行）、追加の観点指示

## 実行手順 🤖

### 1. 引数検証と対象の判別

- 第1引数でディレクトリパスを受け取る（必須）
  - パスが存在しない場合はエラー終了
  - ファイルが指定された場合は親ディレクトリを対象とする
- `--fix` が含まれているかを確認（含まれていれば自動修正モード）
- ディレクトリの内容を `tree` / `Glob` で全体構造を把握する
- 配下ファイルの種別を判別:
  - ドキュメント中心（`.md`, `.txt`, `.rst`, `.adoc`） → **ドキュメント監査** (ステップ 2A)
  - コード中心（`.ts`, `.js`, `.py`, `.go` 等） → **コード監査** (ステップ 2B)
  - 混在 → 両方の観点で監査

---

### 2A. [ultrathink] ドキュメント監査

対象ディレクトリ配下の **全ドキュメントファイルを読み込み**、以下の観点で徹底的に監査する。

#### 2A-1. Prefix 番号と上流・下流の整合性チェック

ドキュメントの内容を読み、各ファイルの「抽象度・上流度」を判定する。

**上流度の判定基準（番号が小さい = より上流）:**

| 上流度 | 内容の特徴 | 典型例 |
|--------|-----------|--------|
| 1（最上流） | プロジェクト全体像、目的、スコープ | README, Overview |
| 2 | 要件定義、ビジネス要件 | Requirements, PRD |
| 3 | システム設計、アーキテクチャ | Architecture, System Design |
| 4 | UX/UI 設計、画面仕様 | UX Design, Wireframes |
| 5 | 機能詳細、API仕様 | Features, API Reference |
| 6 | 非機能要件、セキュリティ | Security, Performance |
| 7 | 開発ガイド、環境構築 | Development Guide, Setup |
| 8 | ユーザージャーニー、テスト | UX Journey, Testing |
| 9 | 将来計画、ロードマップ | Future Extensions, Roadmap |

**チェック項目:**
- 各ファイルの prefix 番号が内容の上流度と一致しているか
- 番号の連続性（歯抜けや重複がないか）
- 上流ドキュメントが下流ドキュメントの内容を前提としていないか（循環依存の検出）
- 推奨される番号割り当てを提案

#### 2A-2. ドキュメント間の相互参照チェック

- ファイル内のリンク（`[text](path)`, `see {file}` 等）を全て抽出
- リンク先が実在するか検証（壊れたリンクの検出）
- 上流→下流の参照方向が正しいか（下流から上流への参照は「前提参照」として OK）
- 相互参照がない孤立ドキュメントがないか

#### 2A-3. 内容の重複・矛盾チェック

- 複数ドキュメント間で同じトピックが重複して記述されていないか
- 記述内容に矛盾がないか（例: A では「REST API」、B では「GraphQL」と記載等）
- 用語の統一性チェック（同じ概念に異なる名前が使われていないか）

#### 2A-4. カバレッジ・ギャップ分析

- 一般的なソフトウェアドキュメントとして期待されるトピックの網羅度
- 各ドキュメントの充実度（概要レベル / 詳細 / 空に近い）
- セクションレベルで TODO や FIXME が残っていないか
- 空のセクション（見出しだけで内容がない）の検出

#### 2A-5. 構造・フォーマット一貫性チェック

- ファイル命名規則の統一性（`{num}-{CAPS}.md` 等）
- Markdown フォーマットの一貫性（見出しレベル、リスト形式等）
- 各ドキュメントに必要なメタ情報（タイトル、概要等）があるか

---

### 2B. [ultrathink] コード監査

対象ディレクトリ配下のコードファイルを分析し、以下の観点で監査する。

#### 2B-1. ディレクトリ構成チェック

- フォルダ構造が一般的なパターンに沿っているか（`src/`, `lib/`, `components/` 等）
- 命名規則の統一性（camelCase, kebab-case, PascalCase 等）
- ファイルの配置が適切か（テストファイルの場所、型定義の場所等）

#### 2B-2. Import / 依存関係チェック

- 循環 import の検出
- 未使用の import がないか
- 相対パスの統一性（`../` の深さが異常なものがないか）
- index ファイルの re-export の整合性

#### 2B-3. Export / API 整合性チェック

- エクスポートされているが使われていないモジュール
- 型定義の整合性（interface / type の重複）
- Public API の一貫性

#### 2B-4. パターン一貫性チェック

- エラーハンドリングパターンの統一性
- ファイル構造のテンプレートパターン一致度
- コメント・JSDoc の有無の一貫性

#### 2B-5. コードとドキュメントの同期チェック

- README や設計書に記載された構造と実際の構造の差異
- 設計書のAPI仕様と実装の不一致
- docs に記載のファイルパスが実在するか

---

### 3. [ultrathink] 修正計画の策定

監査結果を元に、以下の優先度で修正計画を策定する:

- **P0（即修正）**: 壊れたリンク、明らかな矛盾、空ファイル
- **P1（推奨修正）**: Prefix 番号の並び替え、重複内容の統合
- **P2（改善提案）**: カバレッジ向上、フォーマット統一
- **P3（参考情報）**: ベストプラクティスへの準拠度

---

### 4. 自動修正の実行（`--fix` モード時）

`--fix` が指定されている場合、以下を自動で修正する:

#### 4-1. ドキュメントの場合

**Prefix 番号のリナンバリング:**
- 上流度に基づいて最適な番号を再割り当て
- ファイルをリネーム（`mv` コマンド）
- リネーム後、ドキュメント内の相互参照パスも更新
- 修正前後の対応表を表示して確認

**壊れたリンクの修正:**
- リンク先が存在するが、パスが間違っている場合は修正
- リンク先が存在しない場合は `<!-- BROKEN LINK -->` 注釈を追加

**フォーマットの統一:**
- ファイル命名規則の統一
- 必要なメタ情報の追加

#### 4-2. コードの場合

**未使用 import の削除提案:**
- 自動削除はリスクがあるため、対象をリストアップして確認を求める

**命名規則の修正:**
- 明らかな命名規則違反をリストアップ

> **注意**: `--fix` なしの場合はレポート生成のみ（ドライラン）。
> 破壊的変更（ファイルリネーム等）は必ず修正前に確認を表示し、ユーザーの承認を得てから実行する。

---

### 5. HTML レポートファイル生成

出力先: `tasks/audit/` ディレクトリ（なければ作成）

ファイル名: `tasks/audit/audit_{対象名}_{YYYYMMDD_HHMMSS}.html`

- `{対象名}` はディレクトリ名（パス区切りは `_` に変換）

以下の HTML テンプレートに監査結果を埋め込んで生成する。

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>監査レポート - {対象パス}</title>
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
      --success-light: #ebfbee;
      --warning: #e67700;
      --warning-light: #fff9db;
      --danger: #c92a2a;
      --danger-light: #fff5f5;
      --info: #1971c2;
      --info-light: #e7f5ff;
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
        --success-light: #1e2030;
        --warning: #e0af68;
        --warning-light: #1e2030;
        --danger: #f7768e;
        --danger-light: #1e2030;
        --info: #7dcfff;
        --info-light: #1e2030;
      }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans JP', sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.7;
      max-width: 1060px;
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
    }
    .badge-p0 { background: var(--danger-light); color: var(--danger); }
    .badge-p1 { background: var(--warning-light); color: var(--warning); }
    .badge-p2 { background: var(--info-light); color: var(--info); }
    .badge-p3 { background: var(--accent-light); color: var(--accent); }
    .badge-ok { background: var(--success-light); color: var(--success); }
    .badge-fix { background: var(--success-light); color: var(--success); }
    .scorecard {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px; margin: 16px 0;
    }
    .score-item {
      background: var(--bg-secondary); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 16px; text-align: center;
    }
    .score-item .number { font-size: 2rem; font-weight: 700; }
    .score-item .label { font-size: 0.8rem; color: var(--text-secondary); }
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
    .issue-item {
      padding: 12px 16px; border-radius: var(--radius); margin: 8px 0;
      display: flex; align-items: flex-start; gap: 12px;
    }
    .issue-p0 { background: var(--danger-light); border-left: 4px solid var(--danger); }
    .issue-p1 { background: var(--warning-light); border-left: 4px solid var(--warning); }
    .issue-p2 { background: var(--info-light); border-left: 4px solid var(--info); }
    .issue-p3 { background: var(--accent-light); border-left: 4px solid var(--accent); }
    .issue-fixed { background: var(--success-light); border-left: 4px solid var(--success); }
    .key-point {
      padding: 12px 16px; border-left: 4px solid var(--accent);
      background: var(--accent-light); border-radius: 0 var(--radius) var(--radius) 0;
      margin: 8px 0;
    }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .rename-table td:nth-child(2) { text-align: center; font-size: 1.2rem; }
  </style>
</head>
<body>
  <h1>📋 監査レポート</h1>
  <div class="meta">
    <div class="meta-item"><strong>対象:</strong>&nbsp;{対象パス}</div>
    <div class="meta-item"><span class="badge badge-{type}">{ドキュメント or コード}</span></div>
    <div class="meta-item"><strong>監査日時:</strong>&nbsp;{YYYY-MM-DD HH:MM}</div>
    <div class="meta-item"><strong>モード:</strong>&nbsp;{レポートのみ or 自動修正}</div>
  </div>

  <!-- スコアカード -->
  <h2>監査サマリー</h2>
  <div class="scorecard">
    <div class="score-item">
      <div class="number" style="color:var(--danger)">{N}</div>
      <div class="label">P0 即修正</div>
    </div>
    <div class="score-item">
      <div class="number" style="color:var(--warning)">{N}</div>
      <div class="label">P1 推奨修正</div>
    </div>
    <div class="score-item">
      <div class="number" style="color:var(--info)">{N}</div>
      <div class="label">P2 改善提案</div>
    </div>
    <div class="score-item">
      <div class="number" style="color:var(--accent)">{N}</div>
      <div class="label">P3 参考</div>
    </div>
    <div class="score-item">
      <div class="number" style="color:var(--success)">{N}</div>
      <div class="label">修正済み</div>
    </div>
  </div>

  <!-- ディレクトリ構造 -->
  <h2>ディレクトリ構造</h2>
  <pre><code>{tree 出力}</code></pre>

  <!-- === ドキュメント監査の場合 === -->

  <!-- Prefix 番号分析 -->
  <h2>Prefix 番号と上流・下流の整合性</h2>
  <p>prefix 番号が小さいほど上流（抽象度が高い）ドキュメントです。</p>
  <div class="mermaid">
    graph LR
      1[1-README<br>全体像] --> 2[2-REQUIREMENTS<br>要件] --> 3[3-ARCHITECTURE<br>設計]
      3 --> 4[4-UX-DESIGN<br>UI/UX]
      3 --> 5[5-FEATURES<br>機能詳細]
      5 --> 6[6-SECURITY<br>非機能]
      3 --> 7[7-DEVELOPMENT<br>開発ガイド]
  </div>

  <h3>現在の番号割り当て</h3>
  <table>
    <thead><tr><th>#</th><th>現ファイル名</th><th>内容の上流度</th><th>推奨番号</th><th>判定</th></tr></thead>
    <tbody>
      <tr>
        <td>1</td><td><code>{ファイル名}</code></td><td>{判定された上流度}</td>
        <td>{推奨番号}</td><td><span class="badge badge-ok">OK</span> or <span class="badge badge-p1">要変更</span></td>
      </tr>
    </tbody>
  </table>

  <!-- リネーム提案（番号の並び替えが必要な場合） -->
  <h3>リネーム計画</h3>
  <table class="rename-table">
    <thead><tr><th>変更前</th><th></th><th>変更後</th><th>理由</th></tr></thead>
    <tbody>
      <tr><td><code>{旧名}</code></td><td>→</td><td><code>{新名}</code></td><td>{理由}</td></tr>
    </tbody>
  </table>

  <!-- 相互参照チェック -->
  <h2>相互参照の整合性</h2>
  <table>
    <thead><tr><th>ファイル</th><th>参照先</th><th>ステータス</th><th>優先度</th></tr></thead>
    <tbody>
      <tr>
        <td><code>{ファイル名}</code></td><td><code>{リンク先}</code></td>
        <td><span class="badge badge-ok">有効</span> or <span class="badge badge-p0">壊れている</span></td>
        <td><span class="badge badge-p0">P0</span></td>
      </tr>
    </tbody>
  </table>

  <!-- 内容の重複・矛盾 -->
  <h2>内容の重複・矛盾</h2>
  <!-- 重複箇所ごとに issue-item で表示 -->
  <div class="issue-item issue-p1">
    <span class="badge badge-p1">P1</span>
    <div>
      <strong>{トピック}</strong>: <code>{ファイルA}</code> と <code>{ファイルB}</code> で重複記述。
      <br><small>{詳細説明}</small>
    </div>
  </div>

  <!-- 用語の統一性 -->
  <h2>用語の統一性</h2>
  <table>
    <thead><tr><th>概念</th><th>表記揺れ</th><th>出現ファイル</th><th>推奨統一表記</th></tr></thead>
    <tbody>
      <tr>
        <td>{概念}</td><td>{表記A}, {表記B}</td>
        <td><code>{ファイル}</code></td><td><strong>{推奨}</strong></td>
      </tr>
    </tbody>
  </table>

  <!-- カバレッジ -->
  <h2>カバレッジ分析</h2>
  <table>
    <thead><tr><th>期待されるトピック</th><th>カバー状況</th><th>該当ドキュメント</th><th>充実度</th></tr></thead>
    <tbody>
      <tr>
        <td>{トピック}</td>
        <td><span class="badge badge-ok">カバー済</span> or <span class="badge badge-p2">不足</span></td>
        <td><code>{ファイル}</code></td>
        <td>{詳細 / 概要 / 未記載}</td>
      </tr>
    </tbody>
  </table>

  <!-- TODO / FIXME / 空セクション -->
  <h2>未完了項目（TODO / FIXME / 空セクション）</h2>
  <div class="issue-item issue-p0">
    <span class="badge badge-p0">P0</span>
    <div><code>{ファイル名}:{行番号}</code>: {内容}</div>
  </div>

  <!-- === コード監査の場合 === -->
  <!--
  <h2>ディレクトリ構成</h2>
  <h2>Import / 依存関係</h2>
  <h2>Export / API 整合性</h2>
  <h2>パターン一貫性</h2>
  <h2>コード ↔ ドキュメント同期</h2>
  -->

  <!-- 修正アクション -->
  <h2>修正アクション一覧</h2>
  <table>
    <thead><tr><th>#</th><th>優先度</th><th>カテゴリ</th><th>内容</th><th>ステータス</th></tr></thead>
    <tbody>
      <tr>
        <td>1</td>
        <td><span class="badge badge-p0">P0</span></td>
        <td>{カテゴリ}</td>
        <td>{修正内容の説明}</td>
        <td><span class="badge badge-fix">修正済</span> or <span class="badge badge-p1">要対応</span></td>
      </tr>
    </tbody>
  </table>

  <!-- 修正の diff（--fix モードで修正した場合） -->
  <h2>修正内容の詳細（diff）</h2>
  <details>
    <summary>{ファイル名} — {修正概要}</summary>
    <div>
      <pre><code class="language-diff">{diff 内容}</code></pre>
    </div>
  </details>

  <script>
    mermaid.initialize({ startOnLoad: true, theme: 'default' });
    hljs.highlightAll();
  </script>
</body>
</html>
```

**HTML 生成のルール:**

- 上記テンプレートの `{...}` 部分を実際の監査結果で置換する
- 対象がドキュメントかコードかに応じて適切なセクションを選択する
- Mermaid 図は `<div class="mermaid">` タグ内に記述する
- 問題のない項目にも `badge-ok` を付けて健全性を可視化する
- `--fix` モードで修正した箇所は `badge-fix` を付けて修正済みであることを示す
- 修正していない箇所は各優先度バッジと合わせて「要対応」を表示

---

### 6. 自動修正の実行フロー（`--fix` 指定時）

**重要: 破壊的変更の前には必ずユーザーに確認を求める。**

#### ドキュメント Prefix リナンバリングの実行手順:

1. 現在の番号と推奨番号の対応表をユーザーに表示
2. 確認を得てからリネーム実行
3. リネーム後、全ドキュメント内の相互参照パスを一括更新
4. 修正結果を diff として記録

#### 壊れたリンクの修正手順:

1. 壊れたリンクの一覧をユーザーに表示
2. 修正可能なもの（パスの typo 等）は自動修正を提案
3. 修正不能なもの（リンク先自体が存在しない）は `<!-- BROKEN: {reason} -->` 注釈を追加

#### フォーマット統一の手順:

1. 命名規則の違反箇所を表示
2. 修正を実行

---

### 7. 完了ログ出力

- 生成した HTML レポートファイルパスを表示
- 監査サマリー（P0/P1/P2/P3 件数）を表示
- `--fix` モードの場合は修正件数も表示
- 「HTML レポートをブラウザで開いて確認してください」と案内

## 使用例

```bash
# ドキュメントディレクトリを監査（レポートのみ）
/audit diary/docs/

# ドキュメントディレクトリを監査して自動修正も実行
/audit diary/docs/ --fix

# コードディレクトリを監査
/audit src/lib/

# 特定の観点で監査
/audit diary/docs/ セキュリティドキュメントの充実度を重点チェック

# コードとドキュメントの同期チェック
/audit src/ --fix ドキュメントとの整合性を重視
```
