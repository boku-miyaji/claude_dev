# cc-company-ai - HD + PJ会社プラグイン

Claude Code 用の仮想組織プラグイン。`/company` コマンドでHD（ホールディングス）秘書が起動し、複数のPJ会社を統括管理する。

[cc-company](https://github.com/Shin-sibainu/cc-company) にインスパイアされ、複数PJを掛け持ちするAIエンジニア向けにカスタマイズ。

## コンセプト

```
/company           → HD秘書（全社統括・新会社作成・評価）
/company ai        → AI開発会社の秘書
/company circuit   → 回路図PJの秘書
/company rikyu     → りきゅうPJの秘書
```

- **1コマンド・引数で切り替え** - PJごとにコンテキストを完全分離
- **HD = 統括司令塔** - 全PJ会社の横断ダッシュボード・リソース配分
- **PJ会社 = 独立組織** - 必要な部署だけ選んで作成
- **動的作成** - HD秘書に「新しい会社を作って」で即座に新設

## データ構造

```
.company/                ← HD（全社統括）
├── secretary/           ← HD秘書室
├── hr/                  ← 人事部（全社評価）
└── registry.md          ← PJ会社一覧

.company-ai/             ← AI開発会社
├── secretary/
├── ai-dev/              ← AI開発（6チーム）
├── sys-dev/             ← システム開発（3チーム）
├── pm/
├── materials/
├── research/
└── ...

.company-circuit/        ← 回路図PJ
├── secretary/
├── ai-dev/
├── research/
└── ...
```

## 選べる部署

PJ会社作成時に必要な部署だけ選択できる:

| ID | 部署 | 内容 |
|----|------|------|
| ai-dev | AI開発 | 要件定義/設計/実装/アルゴ/評価/AIOps の6チーム |
| sys-dev | システム開発 | バックエンド/フロントエンド/QA の3チーム |
| pm | PM | プロジェクト管理・チケット |
| materials | 資料制作 | 顧客説明資料・提案書・デモ |
| research | リサーチ | マーケット/技術/対象企業調査 の3チーム |

秘書室は全PJ会社に常設。人事部はHDに常設。

## インストール

### GitHub マーケットプレイスから

```
/plugin marketplace add boku-miyaji/claude_dev
/plugin install company@ai-company
```

### ローカルから（開発用）

```
/plugin marketplace add ./
/plugin install company@ai-company
```

## 使い方

### 初回: HDセットアップ

```
/company
```

HD秘書のオンボーディングが始まります。

### PJ会社を作る

```
/company
→ 「AI開発の会社を作って。名前はai」
```

または直接:

```
/company ai
→ 未作成なのでオンボーディングが始まる
```

### 日常的な使い方

```
/company           全社ダッシュボード、横断タスク、壁打ち
/company ai        AI会社で作業
/company circuit   回路図PJで作業
```

### HD秘書に聞けること

- 「ダッシュボード」 - 全PJ会社の状況一覧
- 「どのPJに注力すべき？」 - リソース配分アドバイス
- 「新しい会社を作って」 - PJ会社の新設
- 「〇〇会社を閉じて」 - PJ会社のアーカイブ
- 「評価して」 - 全社横断の組織評価
- 壁打ち・相談 - 全体方針の議論

### PJ会社の秘書に聞けること

- TODO管理、壁打ち、メモ
- 部署への作業振り分け（自動）
- PJ内ダッシュボード
- 部署の追加・統合・廃止

## 人事部の仕組み

HD所属の人事部が全PJ会社を横断評価。

### 評価軸（5軸）

| 評価軸 | 意味 | 低スコア時 |
|--------|------|-----------|
| 自律完遂率 | 追加指示なしで完了 | CLAUDE.mdルール改善 |
| 一発OK率 | やり直し頻度 | テンプレート改善 |
| 連携効率 | 差し戻し率 | 連携プロトコル改善 |
| 目標寄与度 | ゴール直結度 | 方向性再定義 |
| 稼働率 | 利用頻度 | 統合・廃止提案 |

## ファイル構成

```
plugins/company/
├── .claude-plugin/
│   └── plugin.json
└── skills/company/
    ├── SKILL.md                   /company スキル本体
    └── references/
        ├── departments.md         全部署・チームのテンプレート集
        └── claude-md-template.md  HD + PJ会社のCLAUDE.md生成テンプレート
```

## ライセンス

MIT
