---
description: コミット・ブランチ・リポジトリ判定のルール。git操作時に自動適用。
globs: ["**/*"]
---

# コミット・リポジトリルール

## Conventional Commits

- `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- ブランチ命名: `task/{ISSUE-ID}-{slug}` 例) `task/123-user-search-ui`

## リポジトリとコミット先の確認（必須）

> **claude_dev はPJ横断の開発基盤リポジトリ**であり、個別PJ固有のコードやデータはコミットしない。

### コミット前の確認手順

1. **作業ディレクトリ内に独立した `.git` がないか確認する**
   - `circuit_diagram/`, `project-*/`, `*app*/` 等のサブディレクトリは独自リポジトリを持つ場合がある
   - **コミット先は必ずそのディレクトリ内の `.git` が指すリポジトリにする**
   - `git -C <dir> remote -v` で確認すること
2. **claude_dev にコミットしてよいもの**
   - `.claude/` 配下の設定・ルール
   - PJ横断で使う共通ツール・スクリプト
   - docs/ 配下の横断的なドキュメント
3. **claude_dev にコミットしてはいけないもの**
   - 個別PJの実装コード・データ・モデル・実験結果
   - 特定PJの設計書・レポート
   - サブディレクトリに独自リポジトリがある場合のそのPJのファイル

### 具体例

```
claude_dev/
├── circuit_diagram/     ← 独自リポジトリ → ここにコミット
├── project-rikyu/       ← 独自リポジトリ → ここにコミット
├── .claude/             ← claude_dev にコミットOK
└── docs/                ← 横断的なものは claude_dev にコミットOK
```

## ドキュメント同期チェック（IMPORTANT）

以下のファイルを変更した場合、**Blueprint ページの更新が必須**:

| 変更ファイル | 更新先セクション |
|---|---|
| `supabase/functions/ai-agent/` | AI Features タブ |
| `.claude/hooks/*.sh` | Overview（鮮度マップ）+ Harness Engineering |
| `.claude/rules/*.md` | Operations タブ |
| `.company/departments/*/CLAUDE.md` | Operations（部署サイクル） |
| `.company/freshness-policy.yaml` | Overview（自動メンテナンス） |
| `src/pages/Today.tsx` | Design Philosophy |
| `src/lib/fileExtract.ts` | AI Features（ファイル抽出） |
| 商用化関連の意思決定 | Roadmap（意思決定ログ） |

**PostToolUse Hook `docs-sync-guard.sh` が自動で警告するが、更新は手動で行うこと。**

## settings.json 変更のコミット必須ルール

`.claude/settings.json` を変更した場合、**必ず同一コミットにその変更を含める**。

- 方針だけコミットしてファイル変更を未コミットのまま放置しない
- hook の追加・削除は settings.json の変更とセットでコミットする
- 理由: settings.json の変更が未コミットだと auto-push（Stop hook）が拾えず、変更が宙に浮く

## Hook 削除の安全手順

Stop / PostToolUse 等から hook を削除する場合、以下を必須とする:

1. 削除対象の hook が提供していた機能の **代替手段が実在する** ことを確認する
2. 代替手段のファイルパスと動作を明記する（「既にある」だけでは不可）
3. settings.json の変更を含むコミットを作成する
4. 自己参照に注意: auto-push 自身を削除すると、その変更が永遠にコミットされなくなる

## 巨大ファイル / ビルド成果物の commit ガード（2026-04-27 追加）

### 背景

2026-04-27 の incident: rikyu リポジトリで `server/node_modules/next-swc.linux-x64-gnu.node` (113MB) と `.next/dev/cache/turbopack/*.sst` (50-84MB) が auto-save で誤って tracked になり、push 時に GitHub の 100MB 制限で reject。`git filter-repo` で履歴から削除する事故対応が発生した。

### 必須の `.gitignore` 項目（全 PJ 共通）

新規 PJ や既存 PJ で以下が `.gitignore` に **必ず** 入っていることを確認する:

```
# 依存関係（巨大バイナリを含む）
**/node_modules/
node_modules/

# Next.js / Turbopack ビルド成果物・キャッシュ
**/.next/
.next/

# その他ビルド成果物
**/dist/
dist/
**/build/
build/
*.tsbuildinfo
```

PJ ごとのフレームワークに応じて Vite (`.vite/`)、Python (`__pycache__/`、`.venv/`)、Rust (`target/`) 等も追加する。

### 自動防御層（`.claude/hooks/auto-push.sh`）

auto-save Stop hook は commit 直前で以下のパスとサイズを stage から除外する:

| 除外対象 | 理由 |
|---|---|
| `node_modules/` 配下 | 依存関係（巨大バイナリ含む） |
| `.next/` 配下 | Next.js ビルド成果物・Turbopack キャッシュ |
| `dist/` `build/` 配下 | 一般的なビルド成果物 |
| `*.tsbuildinfo` | TypeScript インクリメンタルビルドキャッシュ |
| `*.log` | ログファイル |
| **45MB 超** のファイル | GitHub 50MB 警告ライン手前で防御 |

除外があった場合は `/tmp/auto-push-blocked.json` に記録され、次セッション開始時に SessionStart hook (`auto-push-status-check.sh`) が警告を表示する。

### 「すでに tracked」の場合の対処

`.gitignore` を追加しても、既に tracked になっているファイルは追跡され続ける。以下の手順で除外する:

```bash
# 該当パターンを untrack（作業ツリーには残す）
git rm -r --cached server/node_modules/ server/.next/

# .gitignore を更新済みか確認
grep -E "node_modules|\.next" .gitignore

# commit
git add .gitignore
git commit -m "chore: 巨大ファイルを untrack + .gitignore 整備"
```

履歴から完全に消したい場合（push が reject されている等）は `git filter-repo` を使う（事前にバックアップ branch を作る）:

```bash
git branch backup-before-filter-$(date +%Y%m%d-%H%M%S)
~/.local/bin/git-filter-repo \
  --invert-paths \
  --path-glob 'server/node_modules/*' \
  --path-glob 'server/.next/*' \
  --force
git remote add origin <URL>  # filter-repo は remote を削除する
git push --force origin HEAD
```

### コードレビュー時のチェック

PR / commit を作る時は以下を必ず確認:

- [ ] 50MB 超のファイルが含まれていないか（`git diff --cached --stat | sort -k1 -hr | head` で確認）
- [ ] `node_modules/` `.next/` `dist/` `build/` が含まれていないか
- [ ] `.gitignore` に必要な除外パスがあるか（フレームワーク別）

## PR レビュー・チェックリスト

1. テストは追加されているか
2. 破壊的変更がある場合、README / MIGRATION に記載したか
3. 新規依存は license & size を確認したか
4. **実装変更に対応する Blueprint の更新があるか**
5. **50MB 超のファイル / build artifacts が含まれていないか**
