# Foundry移行会社 - SOMPOケア新分析環境構築PJT支援

## 概要

- **説明**: SOMPOケアのPalantir Foundryからの移行に向けたRFP策定支援。将来のAI開発も見据えたデータ統合基盤の設計方針を策定する
- **作成日**: 2026-03-20
- **HD登録名**: foundry
- **紐づきリポジトリ**: `project-scotch-care/`

## 部署構成

```
.company-foundry/
├── CLAUDE.md
├── secretary/              ← 秘書室（窓口・常設）
│   ├── inbox/
│   ├── todos/
│   └── notes/
├── pm/                     ← PM（プロジェクト管理）
│   ├── projects/
│   └── tickets/
├── sys-dev/                ← システム開発
│   ├── backend/
│   ├── frontend/
│   └── qa/
├── ai-dev/                 ← AI開発
│   ├── requirements/
│   ├── design/
│   ├── implementation/
│   ├── algorithm/
│   ├── evaluation/
│   └── aiops/
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
| 秘書室 | secretary/ | 窓口・TODO・壁打ち・メモ |
| PM | pm/ | プロジェクト管理・マイルストーン・チケット |
| システム開発 | sys-dev/ | バックエンド・フロントエンド・QA |
| AI開発 | ai-dev/ | 要件定義・設計・実装・アルゴ・評価・AIOps |
| 資料制作 | materials/ | 提案書・説明資料・デモ資料 |
| リサーチ | research/ | マーケット・技術・対象企業調査 |

## PJ固有のコンテキスト

### クライアント情報
- **クライアント**: SOMPOケア株式会社
- **支援企業**: ACES
- **プロジェクト名**: 新分析環境構築PJTに向けた計画策定支援
- **目的**: Palantir Foundryからの移行に向けたRFP策定
- **期間**: 2026/2/5 - 2026/3/31

### 主要マイルストーン
- RFI完了 → RFP策定準備フェーズ
- システムの全体像/各種方針策定（~3月中旬）
- RFPの策定と評価基準策定（~3月下旬）
- PoCの設計と評価基準策定（~3月下旬）

### ドキュメント参照先
- `project-scotch-care/docs/` - 各種設計ドキュメント・方針書
- `project-scotch-care/reference_docs/` - 参照資料（PPTX/PDF/XLSX）
- `project-scotch-care/tasks/` - タスク管理

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

SOMPOケアのPalantir Foundry移行PJ。ACESとして計画策定を支援中。将来のAI開発を見据えたデータ基盤の設計方針策定が重要テーマ。RFI完了済みで、RFP策定フェーズに向かっている。技術選定・アーキテクチャ設計・AI Readiness の3軸がPJの核。`project-scotch-care/` に既存ドキュメントが蓄積されており、そこと連携して作業する。
