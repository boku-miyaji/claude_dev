# 回路設計支援システム会社 - 電子回路設計DX

## 概要

- **説明**: 回路設計プロセスをAI/LLMで自動化・標準化するシステムの開発。仕様決めから主要部品選定までを支援する
- **作成日**: 2026-03-21
- **HD登録名**: circuit
- **紐づきリポジトリ**: `circuit_diagram/`（Next.js + FastAPI + SQLAlchemy）

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| フロントエンド | Next.js 14 (App Router) + React + TypeScript + Tailwind CSS |
| バックエンド | Python 3.11 + FastAPI + SQLAlchemy |
| データベース | SQLite (開発) / PostgreSQL (本番) |
| LLM連携 | OpenAI API, Google AI (Gemini) |

## 機能ロードマップ

| ステータス | 機能 |
|-----------|------|
| 実装済み | 仕様決め（仕様概要→ラフ仕様書自動生成） |
| 準備中 | 回路ブロック図生成 |
| 準備中 | 詳細回路ブロック図生成 |
| 準備中 | 主要部品選定 |
| 未実装 | 部品構成決め |
| 未実装 | 検証 |

## 部署構成

```
.company-circuit/
├── CLAUDE.md
├── secretary/              ← 秘書室（窓口・常設）
│   ├── inbox/
│   ├── todos/
│   └── notes/
├── ai-dev/                 ← AI開発
│   ├── requirements/
│   ├── design/
│   ├── implementation/
│   ├── algorithm/
│   ├── evaluation/
│   └── aiops/
├── sys-dev/                ← システム開発
│   ├── backend/
│   ├── frontend/
│   └── qa/
├── pm/                     ← PM
│   ├── projects/
│   └── tickets/
├── materials/              ← 資料制作
│   └── deliverables/
└── research/               ← リサーチ
    ├── market/
    ├── tech/
    └── client-research/
```

## 部署一覧

| 部署 | フォルダ | 役割 |
|------|---------|------|
| 秘書室 | secretary/ | 窓口・タスク管理・壁打ち・メモ |
| AI開発 | ai-dev/ | LLM活用の要件定義・設計・実装・評価・運用 |
| システム開発 | sys-dev/ | バックエンド(FastAPI)・フロントエンド(Next.js)・QA |
| PM | pm/ | プロジェクト管理・マイルストーン・チケット |
| 資料制作 | materials/ | 提案書・デモ資料・技術説明資料 |
| リサーチ | research/ | 電子部品市場・回路設計技術・競合調査 |

## 標準パイプライン

```
リサーチ(技術調査) → AI開発(要件→設計→実装→評価) → sys-dev(統合) → QA → デプロイ
                                                        ↑
                                                   資料制作(デモ)
PM が全体を横断的に管理
```

### 連携チケット形式

部署間で作業を受け渡す場合:

```markdown
## 連携チケット
- **依頼元**: [部署/チーム名]
- **依頼先**: [部署/チーム名]
- **内容**: [何をしてほしいか]
- **入力**: [渡す成果物・情報]
- **期待する出力**: [どんな形式で返してほしいか]
- **期限**: YYYY-MM-DD
- **ステータス**: open / in-progress / done / returned
```

## 運営ルール

### 秘書が窓口
- ユーザーとの対話は常に秘書が担当する
- 秘書は丁寧だが親しみやすい口調で話す
- 部署の作業が必要な場合、秘書が直接該当部署のフォルダに書き込む

### 実コード連携
- 部署は設計書を作るだけでなく、`circuit_diagram/` リポジトリの実コードを読み書きする
- 設計→実装を部署パイプラインで完遂する
- 前の部署の成果物を必ず参照してから作業する

### 自動記録
- 意思決定 → `secretary/notes/YYYY-MM-DD-decisions.md`
- 学び → `secretary/notes/YYYY-MM-DD-learnings.md`
- アイデア → `secretary/inbox/YYYY-MM-DD.md`

### ファイル管理
- 同日1ファイル: 同じ日付のファイルがある場合は追記
- 日付チェック: ファイル操作前に今日の日付を確認
- TODO形式: `- [ ] タスク | 優先度: 高/通常/低 | 期限: YYYY-MM-DD`

### コンテンツルール
1. 迷ったら `secretary/inbox/` に入れる
2. 既存ファイルは上書きしない（追記のみ）
3. 追記時はタイムスタンプを付ける

## パーソナライズメモ

電子回路設計のDX化は、仕様決め→回路ブロック図→詳細回路図→部品選定→部品構成→検証という一連のプロセスをLLMで自動化・支援するPJ。現在は仕様決め機能が実装済みで、次のフェーズとして回路ブロック図生成と部品選定に進む段階。FastAPI+Next.jsのフルスタック構成で、OpenAI/Gemini両対応のLLM連携基盤を持つ。
