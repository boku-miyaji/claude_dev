# 宮路HD - Claude Code 組織プラグイン

Claude Code 用の仮想組織プラグイン。`/company` コマンドでHD秘書が起動し、複数のPJ会社を統括管理する。

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
- **Supabase 連携** - タスク・評価を DB で永続化、Web ダッシュボードと同期

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

## ダッシュボード（Supabase）セットアップ

タスク管理・モバイルアクセス・データ永続化には Web ダッシュボードが必要です。
`/company` プラグイン単体でもローカル（`.company/` ファイル）で動作しますが、
ダッシュボードを使うと Supabase にデータが保存され、PC・スマホから閲覧・操作できます。

**→ [`company-dashboard/README.md`](../../company-dashboard/README.md) の Step 1〜10 を実行してください。**

所要時間: 約15分（Supabase + GitHub OAuth + Vercel）

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

### HD秘書にできること

- 「ダッシュボード」 - 全PJ会社の状況一覧
- 「どのPJに注力すべき？」 - リソース配分アドバイス
- 「新しい会社を作って」 - PJ会社の新設
- 「〇〇会社を閉じて」 - PJ会社のアーカイブ
- 「評価して」 - 全社横断の組織評価（人事部）
- 壁打ち・相談 - 全体方針の議論

### PJ会社の秘書にできること

- TODO管理、壁打ち、メモ
- 部署への作業振り分け（自動）
- PJ内ダッシュボード
- 部署の追加・統合・廃止

## 選べる部署

PJ会社作成時に必要な部署だけ選択:

| ID | 部署 | チーム構成 |
|----|------|-----------|
| ai-dev | AI開発 | 要件定義 / 設計 / 実装 / アルゴ / 評価 / AIOps |
| sys-dev | システム開発 | バックエンド / フロントエンド / QA |
| pm | PM | プロジェクト管理・チケット |
| materials | 資料制作 | 顧客説明資料・提案書・デモ |
| research | リサーチ | マーケット / 技術 / 対象企業調査 |

秘書室は全PJ会社に常設。人事部はHDに常設。

## 人事部（組織最適化エンジン）

社長が最小の指示で最大の成果を得るための CLAUDE.md 継続改善システム。

| 評価軸 | 意味 | 低スコア時のアクション |
|--------|------|----------------------|
| 自律完遂率 | 追加指示なしで完了したか | CLAUDE.md ルール改善 |
| 一発OK率 | やり直しの頻度 | テンプレート・品質基準改善 |
| 連携効率 | 部署間の差し戻し率 | 連携プロトコル改善 |
| 目標寄与度 | ゴールに直結するか | 方向性再定義・統合候補 |
| 稼働率 | 利用頻度 | 統合・廃止提案 |

## Web ダッシュボード

タスク・会社管理をスマホからも操作できる Web UI。
詳細は [`company-dashboard/README.md`](../../company-dashboard/README.md) を参照。

## ファイル構成

```
plugins/company/
├── .claude-plugin/
│   └── plugin.json                プラグイン定義
├── README.md                      This file
└── skills/company/
    ├── SKILL.md                   /company スキル本体
    └── references/
        ├── departments.md         全部署・チームのテンプレート集
        └── claude-md-template.md  HD + PJ会社の CLAUDE.md 生成テンプレート

company-dashboard/                 Web ダッシュボード（別ディレクトリ）
├── index.html                     SPA
├── supabase-setup.sql             DB スキーマ
└── README.md                      セットアップ手順
```

## ライセンス

MIT
