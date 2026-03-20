# 宮路HD - Claude Code 組織プラグイン

Claude Code 用の仮想組織プラグイン。`/company` コマンドで HD 秘書が起動し、複数の PJ 会社を統括管理する。

[cc-company](https://github.com/Shin-sibainu/cc-company) にインスパイアされ、複数 PJ を掛け持ちする AI エンジニア向けにカスタマイズ。

## コンセプト

```
/company           → HD秘書（全社統括・新会社作成・評価）
/company ai        → AI開発会社の秘書
/company circuit   → 回路図PJの秘書
/company rikyu     → りきゅうPJの秘書
```

- **1コマンド・引数で切り替え** — PJごとにコンテキストを完全分離
- **HD = 統括司令塔** — 全PJ会社の横断ダッシュボード・リソース配分
- **PJ会社 = 独立組織** — 必要な部署だけ選んで作成
- **動的作成** — HD秘書に「新しい会社を作って」で即座に新設
- **Supabase 連携** — タスク・ナレッジ・設定を DB で永続化、Web ダッシュボードと同期

---

## クイックスタート

### 1. プラグインのインストール

```
# GitHub マーケットプレイスから
/plugin marketplace add boku-miyaji/claude_dev
/plugin install company@ai-company

# またはローカルから（開発用）
/plugin marketplace add ./
/plugin install company@ai-company
```

### 2. ダッシュボード（Supabase + Vercel）のセットアップ

タスク管理・モバイルアクセス・ナレッジ蓄積には Web ダッシュボードが必要です。
`/company` プラグイン単体でもローカル（`.company/` ファイル）で動作しますが、
ダッシュボードを使うと全サーバー・全端末でデータを共有できます。

**→ [`company-dashboard/README.md`](../../company-dashboard/README.md) の Step 1〜10 を実行（約15分）**

### 3. 初回起動

```
/company
```

HD秘書のオンボーディングが始まります。

---

## 使い方

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

| コマンド例 | 動作 |
|-----------|------|
| 「ダッシュボード」 | 全PJ会社の状況一覧 |
| 「新しい会社を作って」 | PJ会社の新設 |
| 「〇〇会社を閉じて」 | アーカイブ |
| 「評価して」 | 全社横断の組織評価（人事部） |
| 「分析して」 | 社長の行動パターン分析（社長分析部） |
| 「どのPJに注力すべき？」 | リソース配分アドバイス |
| 壁打ち・相談 | 全体方針の議論 |

### PJ会社の秘書にできること

- TODO管理、壁打ち、メモ
- 部署への作業振り分け（自動）
- PJ内ダッシュボード
- 部署の追加・統合・廃止

---

## 選べる部署

PJ会社作成時に必要な部署だけ選択:

| ID | 部署 | チーム構成 |
|----|------|-----------|
| ai-dev | AI開発 | 要件定義 / 設計 / 実装 / アルゴ / 評価 / AIOps |
| sys-dev | システム開発 | バックエンド / フロントエンド / QA |
| pm | PM | プロジェクト管理・チケット |
| materials | 資料制作 | 顧客説明資料・提案書・デモ |
| research | リサーチ | マーケット / 技術 / 対象企業調査 |

秘書室は全PJ会社に常設。人事部 + 社長分析部は HD に常設。

---

## 3つの学習システム

### 1. 人事部（組織最適化エンジン）

CLAUDE.md の継続改善により、Agent の能力を向上させる。

| 評価軸 | 意味 | 低スコア時 |
|--------|------|-----------|
| 自律完遂率 | 追加指示なしで完了 | CLAUDE.md ルール改善 |
| 一発OK率 | やり直し頻度 | テンプレート改善 |
| 連携効率 | 部署間の差し戻し率 | 連携プロトコル改善 |
| 目標寄与度 | ゴール直結度 | 方向性再定義 |
| 稼働率 | 利用頻度 | 統合・廃止提案 |

### 2. ナレッジベース（LLMデフォルトとの差分蓄積）

```
社長の修正指示 → 自動検出 → knowledge_base に蓄積
→ 同じルール再確認で confidence 上昇
→ confidence ≥ 3 で CLAUDE.md 昇格提案
→ 次回以降は指示なしで暗黙適用
```

9カテゴリ: coding / documentation / communication / design / process / quality / tools / domain / other

### 3. 社長分析部（CEO Insights）

社長のプロンプト履歴を分析し、行動パターン・好み・傾向を蓄積。
各部署が「言われなくても最適な判断」をできるようにする。

| カテゴリ | 内容 |
|---------|------|
| pattern | 行動パターン（いつ何をするか） |
| preference | 好み（出力形式、ツール選択） |
| strength | 得意分野 |
| tendency | 傾向（見落とし、後回し） |
| feedback | 修正フィードバック蓄積 |

---

## 全サーバー反映の仕組み

```
サーバーA で /company → 作業 → commit & push → Supabase に同期
                                                      ↓
サーバーB で /company → pull → Supabase から最新データ取得
                                                      ↓
スマホでダッシュボード → リアルタイム反映
```

- `/company` 起動時に自動同期（settings.json + CLAUDE.md → Supabase）
- 作業完了後に自動 commit & push
- ダッシュボードは Supabase Realtime で即座に反映

---

## ファイル構成

```
plugins/company/
├── .claude-plugin/
│   └── plugin.json                 プラグイン定義
├── README.md                       This file
└── skills/company/
    ├── SKILL.md                    /company スキル本体
    └── references/
        ├── departments.md          全部署・チームのテンプレート集
        └── claude-md-template.md   HD + PJ会社の CLAUDE.md 生成テンプレート

company-dashboard/                  Web ダッシュボード
├── index.html                      SPA (単一ファイル)
├── supabase-setup.sql              DB スキーマ
├── supabase-migration-*.sql        既存DB用マイグレーション
└── README.md                       セットアップ手順（Step 1〜10）
```

## ライセンス

MIT
