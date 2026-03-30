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

## PR レビュー・チェックリスト

1. テストは追加されているか
2. 破壊的変更がある場合、README / MIGRATION に記載したか
3. 新規依存は license & size を確認したか
