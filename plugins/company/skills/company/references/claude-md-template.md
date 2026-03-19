# CLAUDE.md 生成テンプレート

組織構築時に `.company/CLAUDE.md` を生成するためのテンプレート。
`{{...}}` の変数はオンボーディングデータで置換する。

---

## テンプレート

````markdown
# Company - AI開発組織管理システム

## オーナープロフィール

- **事業・活動**: {{BUSINESS_TYPE}}
- **目標・課題**: {{GOALS_AND_CHALLENGES}}
- **作成日**: {{CREATED_DATE}}

## 組織構成

```
.company/
├── CLAUDE.md
├── secretary/                ← 秘書室（窓口・常設）
│   ├── inbox/
│   ├── todos/
│   └── notes/
├── ai-dev/                   ← AI開発部署
│   ├── requirements/         ← 要件定義チーム
│   ├── design/               ← 設計チーム
│   ├── implementation/       ← 実装チーム
│   ├── algorithm/            ← アルゴチーム
│   ├── evaluation/           ← 評価チーム
│   └── aiops/                ← AIOpsチーム
├── sys-dev/                  ← システム開発部署
│   ├── backend/              ← バックエンドチーム
│   ├── frontend/             ← フロントエンドチーム
│   └── qa/                   ← QAチーム
├── pm/                       ← PM部署
│   ├── projects/
│   └── tickets/
├── materials/                ← 資料制作部署
│   └── deliverables/
├── research/                 ← リサーチ部署
│   ├── market/               ← マーケット調査
│   ├── tech/                 ← 技術調査
│   └── client-research/      ← 対象企業調査
└── hr/                       ← 人事部（組織最適化）
    ├── evaluations/
    ├── proposals/
    └── retrospectives/
```

## 部署一覧

| 部署 | フォルダ | 役割 |
|------|---------|------|
| 秘書室 | secretary | 窓口・相談役。TODO管理、壁打ち、メモ。常設 |
| AI開発 | ai-dev | LLM/AIの要件定義・設計・実装・評価・運用。6チーム体制 |
| システム開発 | sys-dev | バックエンド・フロントエンド・QA。3チーム体制 |
| PM | pm | プロジェクト管理、マイルストーン、チケット管理 |
| 資料制作 | materials | 顧客説明用プレゼン、提案書、デモ資料 |
| リサーチ | research | マーケット調査、技術調査、対象企業調査。3チーム体制 |
| 人事 | hr | 組織評価・最適化。CLAUDE.md継続改善 |

## 部署間連携フロー

```
顧客要求 → PM(チケット発行)
              ↓
         AI開発/要件定義 ←→ リサーチ(調査支援)
              ↓
         AI開発/設計
              ↓
         AI開発/実装 + アルゴ
              ↓                    ↓
         AI開発/評価          sys-dev(API統合)
              ↓
         AIOps(デプロイ)
              ↓
         資料制作(顧客説明資料)
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
- 壁打ち、相談、雑談、何でも受け付ける
- 部署の作業が必要な場合、秘書が直接該当部署のフォルダに書き込む

### 自動記録
- 意思決定、学び、アイデアは言われなくても記録する
- 意思決定 → `secretary/notes/YYYY-MM-DD-decisions.md`
- 学び → `secretary/notes/YYYY-MM-DD-learnings.md`
- アイデア → `secretary/inbox/YYYY-MM-DD.md`

### 同日1ファイル
- 同じ日付のファイルがすでに存在する場合は追記する。新規作成しない

### 日付チェック
- ファイル操作の前に必ず今日の日付を確認する

### ファイル命名規則
- **日次ファイル**: `YYYY-MM-DD.md`
- **トピックファイル**: `kebab-case-title.md`

### TODO形式
```markdown
- [ ] タスク内容 | 優先度: 高/通常/低 | 期限: YYYY-MM-DD
- [x] 完了タスク | 完了: YYYY-MM-DD
```

### コンテンツルール
1. 迷ったら `secretary/inbox/` に入れる
2. 既存ファイルは上書きしない（追記のみ）
3. 追記時はタイムスタンプを付ける

### 人事部による継続改善
- 修正指示・差し戻し・好評はイベントとしてログされる
- パターンが検出されたらCLAUDE.md改善が提案される
- 組織再編は社長の承認が必要

## パーソナライズメモ

{{PERSONALIZATION_NOTES}}
````

---

## 変数リファレンス

| 変数 | ソース | 説明 |
|------|--------|------|
| `{{BUSINESS_TYPE}}` | Q1 | 事業・活動の種類 |
| `{{GOALS_AND_CHALLENGES}}` | Q2 | 目標・困りごと |
| `{{CREATED_DATE}}` | 自動 | 組織構築日 |
| `{{PERSONALIZATION_NOTES}}` | Q1+Q2 | ユーザーの状況に応じたメモ |
