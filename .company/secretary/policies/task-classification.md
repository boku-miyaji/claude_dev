# タスク・プロンプト分類体系

## タスクのタグ（複数付与必須）

### 軸1: スコープ（どこの仕事か）

<!-- GENERATED:SCOPE_TAGS:START -->
| タグ | 意味 |
|------|------|
| `hd` | HD全社横断 |
| `pj:foundry` | Foundry移行会社 |
| `pj:rikyu` | りきゅう |
| `pj:circuit` | 回路設計支援システム会社 |
| `pj:polaris` | Polaris AI |
| `personal` | 個人のこと |
<!-- GENERATED:SCOPE_TAGS:END -->

### 軸2: 部署

<!-- GENERATED:DEPT_TAGS:START -->
| タグ | 意味 |
|------|------|
| `dept:ai-dev` | AI開発部署 |
| `dept:intelligence` | 情報収集部 |
| `dept:materials` | 資料制作部署 |
| `dept:pm` | PM |
| `dept:research` | リサーチ部署 |
| `dept:security` | セキュリティ部 |
| `dept:sys-dev` | システム開発部署 |
| `dept:hr` | 人事 |
| `dept:secretary` | 秘書室 |
<!-- GENERATED:DEPT_TAGS:END -->

### 軸3: カテゴリ

| タグ | 意味 |
|------|------|
| `cat:feature` | 新機能開発 |
| `cat:bugfix` | バグ修正 |
| `cat:security` | セキュリティ対策 |
| `cat:infra` | インフラ/CI/CD |
| `cat:docs` | ドキュメント |
| `cat:design` | 設計 |
| `cat:research` | 調査 |
| `cat:ops` | 運用改善 |
| `cat:dashboard` | ダッシュボード |

### 軸4: 技術領域（該当する場合のみ）

| タグ | 意味 |
|------|------|
| `tech:github-actions` | GitHub Actions |
| `tech:supabase` | Supabase |
| `tech:nextjs` | Next.js |
| `tech:python` | Python |
| `tech:mcp` | MCP |
| `tech:llm` | LLM/AI |

## プロンプトのタグ（複数付与必須）

上記の軸1-4に加えて:

### 軸0: 指示の種類

| タグ | 意味 |
|------|------|
| `intent:implement` | 実装指示 |
| `intent:fix` | 修正指示 |
| `intent:investigate` | 調査指示 |
| `intent:design` | 設計指示 |
| `intent:review` | レビュー依頼 |
| `intent:brainstorm` | 壁打ち/相談 |
| `intent:manage` | 管理/運用指示 |
| `intent:info` | 情報提供/確認 |

## 運用ルール

1. **タスク作成時**: 最低3軸（スコープ + 部署 or カテゴリ + もう1つ）を付与
2. **プロンプト記録時**: 最低2軸（intent + スコープ）を付与
3. **分類不能な場合**: 秘書が新カテゴリを提案し、このドキュメントを更新
4. **タスク完了時**: status を `done` に更新 + completed_at を設定
5. **放置防止**: `/company` 起動時に 7日以上 open のタスクをリマインド
