# 回路設計支援システム会社 - 電子回路設計DX

## 概要

- **説明**: 電子回路設計DXシステム開発（仕様決め→回路ブロック図→部品選定のAI自動化）
- **作成日**: 2026-03-20
- **HD登録名**: circuit
- **紐づきリポジトリ**: `circuit_diagram/`

## 技術スタック

- Next.js
- FastAPI
- SQLAlchemy
- OpenAI
- Gemini

## 部署構成

```
.company-circuit/
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

## 秘書の役割

- ユーザーの指示を受けて適切な部署に振り分け
- TODO・タスク管理
- 壁打ち・相談対応
- 紐づきリポジトリ（circuit_diagram/）の実コードとの連携

## 運営ルール

### 自動記録
- 意思決定 → `secretary/notes/YYYY-MM-DD-decisions.md`
- 学び → `secretary/notes/YYYY-MM-DD-learnings.md`
- アイデア → `secretary/inbox/YYYY-MM-DD.md`

### ファイル管理
- 同日1ファイル: 同じ日付のファイルがある場合は追記
- 日付チェック: ファイル操作前に今日の日付を確認
- TODO形式: `- [ ] タスク | 優先度: 高/通常/低 | 期限: YYYY-MM-DD`
