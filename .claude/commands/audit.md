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
- 第2引数以降（オプション）: 追加の観点指示

## 全体フロー

```
Phase 1: 監査・分析（自動実行）
  ↓
Phase 2: 修正方針の提示（HTMLレポート + コンソール要約）
  ↓  ← ここで必ず停止し、ユーザーの判断を待つ
Phase 3: 修正実行（ユーザーが承認した項目のみ）
```

**重要: Phase 2 まで実行したら必ず停止する。Phase 3 に進むのはユーザーが明示的に承認した場合のみ。**

---

## Phase 1: 監査・分析

### 1. 引数検証と対象の判別

- 第1引数でディレクトリパスを受け取る（必須）
  - パスが存在しない場合はエラー終了
  - ファイルが指定された場合は親ディレクトリを対象とする
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

#### 2A-2. ドキュメント間の相互参照チェック

- ファイル内のリンク（`[text](path)`, `see {file}` 等）を全て抽出
- リンク先が実在するか検証（壊れたリンクの検出）
- 上流→下流の参照方向が正しいか
- 相互参照がない孤立ドキュメントがないか

#### 2A-3. 内容の重複・矛盾チェック

- 複数ドキュメント間で同じトピックが重複して記述されていないか
- 記述内容に矛盾がないか（例: A では「REST API」、B では「GraphQL」と記載等）
- 用語の統一性チェック（同じ概念に異なる名前が使われていないか）

#### 2A-4. 冗長性分析

ドキュメントの冗長性を以下の観点で検出する:

**ファイル間の冗長性（横断的な重複）:**
- 同一または類似の説明が複数ファイルに存在する箇所を特定
- どのファイルに記述を残し、どのファイルからは参照に変えるべきかを判定
  - 判定基準: より上流のドキュメント or そのトピックの本来の責務を持つドキュメントに記述を残す
- コピペされた定義・仕様を検出（例: 同じテーブル定義が複数箇所にある等）

**ファイル内の冗長性:**
- 同一ファイル内での繰り返し表現・説明の検出
- 不要に長い導入文や繰り返しの注意書き
- 情報密度が低いセクション（行数に対して実質的な情報が少ない）

**冗長性のスコアリング:**

各検出項目に以下を付与する:

| フィールド | 内容 |
|-----------|------|
| 場所 | ファイル名 + セクション or 行範囲 |
| 種類 | `cross-file-dup`（ファイル間重複）/ `in-file-dup`（ファイル内重複）/ `low-density`（情報密度低） / `verbose`（冗長表現） |
| 影響度 | 削減可能な推定行数 |
| 提案 | 具体的な改善案（「{fileB} の記述を削除し {fileA} への参照に置換」等） |

#### 2A-5. カバレッジ・ギャップ分析

- 一般的なソフトウェアドキュメントとして期待されるトピックの網羅度
- 各ドキュメントの充実度（概要レベル / 詳細 / 空に近い）
- セクションレベルで TODO や FIXME が残っていないか
- 空のセクション（見出しだけで内容がない）の検出

#### 2A-6. 構造・フォーマット一貫性チェック

- ファイル命名規則の統一性（`{num}-{CAPS}.md` 等）
- Markdown フォーマットの一貫性（見出しレベル、リスト形式等）
- 各ドキュメントに必要なメタ情報（タイトル、概要等）があるか

---

### 2B. [ultrathink] コード監査

対象ディレクトリ配下のコードファイルを分析し、以下の観点で監査する。

#### 2B-1. ディレクトリ構成チェック

- フォルダ構造が一般的なパターンに沿っているか
- 命名規則の統一性（camelCase, kebab-case, PascalCase 等）
- ファイルの配置が適切か（テストファイルの場所、型定義の場所等）

#### 2B-2. Import / 依存関係チェック

- 循環 import の検出
- 未使用の import がないか
- 相対パスの統一性
- index ファイルの re-export の整合性

#### 2B-3. Export / API 整合性チェック

- エクスポートされているが使われていないモジュール
- 型定義の整合性（interface / type の重複）
- Public API の一貫性

#### 2B-4. コード冗長性分析

**ファイル間の冗長性:**
- 重複コード（類似ロジックが複数箇所に存在）
- 共通化すべきユーティリティ関数・型定義の候補
- コピペされたコードブロックの検出

**ファイル内の冗長性:**
- 同一パターンの繰り返し（ループやマッピングで置換可能）
- 不要な中間変数・冗長な条件分岐
- Dead code（到達不能コード、使われていない関数・変数）

**冗長性のスコアリング:**

| フィールド | 内容 |
|-----------|------|
| 場所 | ファイルパス + 行範囲 |
| 種類 | `duplicate`（重複コード）/ `extractable`（共通化可能）/ `dead-code`（不要コード）/ `verbose-pattern`（冗長パターン） |
| 影響度 | 削減可能な推定行数 |
| 提案 | 具体的なリファクタリング案 |

#### 2B-5. パターン一貫性チェック

- エラーハンドリングパターンの統一性
- ファイル構造のテンプレートパターン一致度

#### 2B-6. コードとドキュメントの同期チェック

- README や設計書に記載された構造と実際の構造の差異
- 設計書のAPI仕様と実装の不一致
- docs に記載のファイルパスが実在するか

---

## Phase 2: 修正方針の提示

### 3. [ultrathink] 修正計画の策定

監査結果を元に、以下の優先度で修正計画を策定する:

- **P0（即修正）**: 壊れたリンク、明らかな矛盾、空ファイル
- **P1（推奨修正）**: Prefix 番号の並び替え、冗長コンテンツの統合、重複コードの共通化
- **P2（改善提案）**: カバレッジ向上、フォーマット統一、冗長表現の簡潔化
- **P3（参考情報）**: ベストプラクティスへの準拠度

### 4. HTML レポートファイル生成

出力先: `tasks/audit/` ディレクトリ（なければ作成）

ファイル名: `tasks/audit/audit_{対象名}_{YYYYMMDD_HHMMSS}.html`

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
    .key-point {
      padding: 12px 16px; border-left: 4px solid var(--accent);
      background: var(--accent-light); border-radius: 0 var(--radius) var(--radius) 0;
      margin: 8px 0;
    }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .rename-table td:nth-child(2) { text-align: center; font-size: 1.2rem; }
    .redundancy-bar {
      height: 8px; border-radius: 4px; background: var(--bg-code); overflow: hidden; margin: 4px 0;
    }
    .redundancy-bar-fill {
      height: 100%; border-radius: 4px;
    }
  </style>
</head>
<body>
  <h1>監査レポート</h1>
  <div class="meta">
    <div class="meta-item"><strong>対象:</strong>&nbsp;{対象パス}</div>
    <div class="meta-item"><span class="badge badge-{type}">{ドキュメント or コード}</span></div>
    <div class="meta-item"><strong>監査日時:</strong>&nbsp;{YYYY-MM-DD HH:MM}</div>
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
      <div class="number" style="color:var(--warning)">{N行}</div>
      <div class="label">冗長（削減可能）</div>
    </div>
  </div>

  <!-- ディレクトリ構造 -->
  <h2>ディレクトリ構造</h2>
  <pre><code>{tree 出力}</code></pre>

  <!-- === ドキュメント監査セクション === -->

  <!-- Prefix 番号分析 -->
  <h2>Prefix 番号と上流・下流の整合性</h2>
  <p>prefix 番号が小さいほど上流（抽象度が高い）ドキュメントです。</p>
  <div class="mermaid">
    graph LR
      1[1-README<br>全体像] --> 2[2-REQUIREMENTS<br>要件] --> 3[3-ARCHITECTURE<br>設計]
      3 --> 4[4-UX-DESIGN<br>UI/UX]
      3 --> 5[5-FEATURES<br>機能詳細]
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

  <h3>リネーム計画（提案）</h3>
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
  <div class="issue-item issue-p1">
    <span class="badge badge-p1">P1</span>
    <div>
      <strong>{トピック}</strong>: <code>{ファイルA}</code> と <code>{ファイルB}</code> で重複記述。
      <br><small>{詳細説明}</small>
    </div>
  </div>

  <!-- 冗長性分析 -->
  <h2>冗長性分析</h2>
  <p>削減可能な冗長コンテンツの分析結果です。</p>

  <h3>サマリー</h3>
  <div class="card">
    <table>
      <thead><tr><th>種類</th><th>検出数</th><th>削減可能行数</th></tr></thead>
      <tbody>
        <tr><td>ファイル間重複</td><td>{N}件</td><td>約{N}行</td></tr>
        <tr><td>ファイル内重複</td><td>{N}件</td><td>約{N}行</td></tr>
        <tr><td>情報密度低</td><td>{N}件</td><td>約{N}行</td></tr>
        <tr><td>冗長表現</td><td>{N}件</td><td>約{N}行</td></tr>
        <tr style="font-weight:700"><td>合計</td><td>{N}件</td><td>約{N}行</td></tr>
      </tbody>
    </table>
  </div>

  <h3>詳細</h3>
  <!-- 各検出項目を details で折りたたみ -->
  <details>
    <summary>
      <span class="badge badge-p1">P1</span>&nbsp;
      <span class="badge" style="background:var(--bg-code);color:var(--text-secondary)">{種類}</span>&nbsp;
      {概要} — 削減可能: 約{N}行
    </summary>
    <div>
      <p><strong>場所:</strong> <code>{ファイル名}:{行範囲}</code></p>
      <p><strong>内容:</strong> {重複・冗長の具体的な説明}</p>
      <p><strong>提案:</strong> {具体的な改善案}</p>
      <!-- 該当箇所の抜粋があれば表示 -->
      <pre><code>{該当コンテンツの抜粋}</code></pre>
    </div>
  </details>

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

  <!-- === コード監査セクション === -->
  <!--
  <h2>ディレクトリ構成</h2>
  <h2>Import / 依存関係</h2>
  <h2>Export / API 整合性</h2>
  <h2>コード冗長性分析</h2>
  <h2>パターン一貫性</h2>
  <h2>コード ↔ ドキュメント同期</h2>
  -->

  <!-- 修正方針（全項目をアクションリストとして提示） -->
  <h2>修正方針（提案）</h2>
  <p>以下は提案です。実行するにはユーザーの承認が必要です。</p>
  <table>
    <thead><tr><th>#</th><th>優先度</th><th>カテゴリ</th><th>修正内容</th><th>影響範囲</th></tr></thead>
    <tbody>
      <tr>
        <td>A-1</td>
        <td><span class="badge badge-p0">P0</span></td>
        <td>{カテゴリ}</td>
        <td>{修正内容の説明}</td>
        <td><code>{影響ファイル}</code></td>
      </tr>
      <tr>
        <td>A-2</td>
        <td><span class="badge badge-p1">P1</span></td>
        <td>冗長性削減</td>
        <td>{統合・削減の具体的な説明}</td>
        <td><code>{影響ファイル}</code></td>
      </tr>
    </tbody>
  </table>

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
- 全ての修正提案には「提案」であることを明示する

### 5. コンソールへの要約出力と停止

HTML レポート生成後、以下をコンソールに出力して **必ず停止する**:

```
📋 監査完了 — {対象パス}

■ 検出サマリー
  P0（即修正）:   {N}件
  P1（推奨修正）: {N}件
  P2（改善提案）: {N}件
  P3（参考情報）: {N}件
  冗長性:         約{N}行 削減可能

■ 修正方針（{M}件の提案）
  A-1: [P0] {概要}
  A-2: [P1] {概要}
  A-3: [P1] {概要}
  ...

📄 詳細レポート: {HTMLファイルパス}

修正を実行しますか？
  - 全て実行する場合: 「全部修正して」
  - 選択する場合: 「A-1, A-3 を修正して」
  - 修正しない場合: そのまま別の作業に進んでください
```

**ここで必ず停止する。ユーザーの指示があるまで Phase 3 には進まない。**

---

## Phase 3: 修正実行（ユーザー承認後のみ）

ユーザーが修正を指示した場合のみ、承認された項目に限って以下を実行する。

### 6. 修正の実行

#### ドキュメントの場合

**Prefix 番号のリナンバリング:**
1. ファイルをリネーム（`mv` コマンド）
2. リネーム後、全ドキュメント内の相互参照パスを一括更新
3. 修正前後の diff を表示

**壊れたリンクの修正:**
1. パスの typo 等は正しいパスに修正
2. リンク先が存在しない場合は `<!-- BROKEN: {reason} -->` 注釈を追加

**冗長性の削減:**
1. ファイル間重複: 重複記述を削除し、本来の責務ドキュメントへの参照リンクに置換
2. ファイル内重複: 繰り返し表現を統合・簡潔化
3. 情報密度低のセクション: 内容を凝縮して書き直し

**フォーマットの統一:**
1. ファイル命名規則の統一
2. 必要なメタ情報の追加

#### コードの場合

**冗長性の削減:**
1. 重複コードの共通関数化を実施（ユーザー指定のものだけ）
2. Dead code の削除

**未使用 import の削除:**
- ユーザーが承認した対象のみ削除

### 7. 修正結果の表示

修正完了後、以下を出力:

```
✅ 修正完了

■ 実行した修正
  A-1: [P0] {概要} → 完了
  A-3: [P1] {概要} → 完了

■ 変更ファイル
  - {ファイル1}: {変更概要}
  - {ファイル2}: {変更概要}
```

---

## 使用例

```bash
# ドキュメントディレクトリを監査（レポート生成 → 方針提示で停止）
/audit diary/docs/

# コードディレクトリを監査
/audit src/lib/

# 特定の観点で監査
/audit diary/docs/ セキュリティドキュメントの充実度を重点チェック
```

ユーザーの応答例:
```
# レポートを見て、全て修正
> 全部修正して

# 選択的に修正
> A-1 と A-3 だけ修正して

# 冗長性の修正だけ実行
> 冗長性関連だけ修正して

# 修正しない
> OK、レポートだけで大丈夫
```
