# cc-company-ai - AI開発組織プラグイン

Claude Code 用の仮想組織プラグイン。`/company` コマンドで秘書AIが起動し、AI開発・システム開発を中心とした組織を管理する。

[cc-company](https://github.com/Shin-sibainu/cc-company) にインスパイアされ、AI開発チームの業務に最適化したカスタム版。

## 特徴

- **秘書が窓口** - ユーザーは部署を意識せず、秘書に話しかけるだけ
- **AI開発に特化した6チーム体制** - 要件定義 / 設計 / 実装 / アルゴ / 評価 / AIOps
- **システム開発3チーム** - バックエンド / フロントエンド / QA
- **人事部 = 組織最適化エンジン** - CLAUDE.mdを継続改善し、Agentの能力を向上
- **部署のライフサイクル管理** - 追加・統合・廃止を社長承認で実行

## 組織構成

```
.company/
├── secretary/        秘書室（窓口・常設）
├── ai-dev/           AI開発（6チーム）
│   ├── requirements/   要件定義
│   ├── design/         設計
│   ├── implementation/ 実装
│   ├── algorithm/      アルゴ
│   ├── evaluation/     評価
│   └── aiops/          AIOps
├── sys-dev/          システム開発（3チーム）
│   ├── backend/        バックエンド
│   ├── frontend/       フロントエンド
│   └── qa/             QA
├── pm/               PM
├── materials/        資料制作
├── research/         リサーチ（3チーム）
│   ├── market/         マーケット調査
│   ├── tech/           技術調査
│   └── client-research/ 対象企業調査
└── hr/               人事部（組織最適化）
```

## インストール

### 方法1: GitHub マーケットプレイスから（推奨）

Claude Code 内で以下を実行：

```
/plugin marketplace add boku-miyaji/claude_dev
/plugin install company@ai-company
```

### 方法2: ローカルからインストール（開発用）

```bash
# リポジトリをクローン
git clone https://github.com/boku-miyaji/claude_dev.git

# Claude Code 内でローカルマーケットプレイスを追加
/plugin marketplace add ./claude_dev
/plugin install company@ai-company
```

### インストール確認

```
/company
```

秘書のオンボーディングが始まれば成功です。

## 使い方

### 初回起動

```
/company
```

秘書が2つの質問をします：
1. あなたの事業・活動
2. 目標・困りごと

回答をもとに `.company/` が自動生成されます。

### 日常的な使い方

```
/company
```

で秘書に話しかけるだけ。例：

- 「今日のTODOを見せて」
- 「LLMの精度改善について壁打ちしたい」
- 「顧客向けのデモ資料を作りたい」
- 「ダッシュボード」
- 「組織を評価して」

秘書が適切な部署に振り分けて処理します。

### 部署の追加・削除

```
「営業部署を作って」  → 即座に作成
「評価して」          → 人事部が全部署を評価し、統合・廃止を提案
```

## 人事部の仕組み

人事部は「社長が最小の指示で最大の成果を得る」ための最適化エンジンです。

### 評価軸（5軸）

| 評価軸 | 意味 |
|--------|------|
| 自律完遂率 | 追加指示なしで完了したか |
| 一発OK率 | やり直しの頻度 |
| 連携効率 | 部署間の差し戻し率 |
| 目標寄与度 | ゴールに直結するか |
| 稼働率 | 使われているか |

### 自動トリガー

- 同じ修正指示が2回 → CLAUDE.mdルール改善提案
- 稼働なし3回 → 統合・廃止提案
- 差し戻し2回 → 連携プロトコル改善提案

## カスタマイズ

### 部署・チームの変更

[departments.md](plugins/company/skills/company/references/departments.md) を編集して、部署構成やテンプレートを変更できます。

### 秘書のキャラクター変更

[departments.md](plugins/company/skills/company/references/departments.md) 内の `secretary/CLAUDE.md` セクションを編集してください。

## ファイル構成

```
plugins/company/
├── .claude-plugin/
│   └── plugin.json               プラグイン定義
└── skills/company/
    ├── SKILL.md                   /company スキル本体
    └── references/
        ├── departments.md         全部署・チームのテンプレート集
        └── claude-md-template.md  組織CLAUDE.md生成テンプレート
```

## ライセンス

MIT
