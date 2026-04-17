# Claude Dev Repository

開発用の Claude Code 設定とカスタムコマンド集

## 📦 セットアップ

### 1. リポジトリをクローン

```bash
git clone git@github.com:boku-miyaji/claude_dev.git
cd claude_dev
```

### 2. Claude Code プラグインのセットアップ

このプロジェクトでは以下のプラグインを使用しています：

```bash
# セットアップスクリプトを実行（推奨プラグイン一覧を表示）
bash .claude/setup-plugins.sh
```

#### 推奨プラグイン一覧

| プラグイン        | マーケットプレイス      | 用途                       |
| ----------------- | ----------------------- | -------------------------- |
| document-skills   | anthropic-agent-skills  | ドキュメント作成支援       |
| frontend-design   | claude-plugins-official | フロントエンド設計         |
| context7          | claude-plugins-official | ライブラリドキュメント検索 |
| serena            | claude-plugins-official | セマンティックコード編集   |
| pr-review-toolkit | claude-plugins-official | PR レビュー支援            |
| github            | claude-plugins-official | GitHub 連携                |
| code-review       | claude-plugins-official | コードレビュー             |
| security-guidance | claude-plugins-official | セキュリティガイダンス     |
| supabase          | claude-plugins-official | Supabase 連携              |
| commit-commands   | claude-plugins-official | コミット支援               |

#### 手動インストール方法

Claude Code 内で以下のコマンドを実行：

```
/plugin install document-skills@anthropic-agent-skills
/plugin install frontend-design@claude-plugins-official
/plugin install context7@claude-plugins-official
/plugin install serena@claude-plugins-official
/plugin install pr-review-toolkit@claude-plugins-official
/plugin install github@claude-plugins-official
/plugin install code-review@claude-plugins-official
/plugin install security-guidance@claude-plugins-official
/plugin install supabase@claude-plugins-official
/plugin install commit-commands@claude-plugins-official
```

## 🔧 利用可能なコマンド

### ドキュメント管理

#### `/init-docs` - ドキュメント雛形作成

新しいリポジトリのドキュメント構造を自動生成します。

```bash
/init-docs my-project
```

詳細は [.claude/commands/README.md](.claude/commands/README.md) を参照。

### タスク管理ワークフロー

| コマンド                    | 説明                       |
| --------------------------- | -------------------------- |
| `/1-1-create-task`          | ローカルタスクファイル作成 |
| `/1-2-sync_tasks`           | GitHub Issues 同期         |
| `/2-design`                 | 設計書作成                 |
| `/3-implement`              | 実装                       |
| `/4-reimplement`            | 再実装                     |
| `/5-update-pr`              | PR 更新                    |
| `/6-push-pr`                | PR 作成・プッシュ          |
| `/backward-commit`          | コミット取り消し           |
| `/workflow_overview_review` | ワークフロー全体レビュー   |

詳細は [.claude/commands/README.md](.claude/commands/README.md) を参照。

## 📚 ディレクトリ構造

```
.
├── .claude/
│   ├── commands/           # カスタムスラッシュコマンド
│   │   ├── README.md       # コマンド一覧
│   │   ├── init-docs.md    # ドキュメント雛形作成
│   │   ├── 1-1-create-task.md
│   │   ├── 1-2-sync_tasks.md
│   │   ├── 2-design.md
│   │   ├── 3-implement.md
│   │   ├── 4-reimplement.md
│   │   ├── 5-update-pr.md
│   │   ├── 6-push-pr.md
│   │   ├── backward-commit.md
│   │   └── workflow_overview_review.md
│   ├── skills/             # カスタムスキル
│   ├── plugins/            # プラグイン設定（キャッシュは除外）
│   ├── setup-plugins.sh    # プラグインセットアップスクリプト
│   ├── CLAUDE.md           # プロジェクト規約
│   └── .claude.json        # Claude Code設定
├── diary/                  # Diaryアプリプロジェクト
├── youtube_translater/     # YouTube Translatorプロジェクト
└── README.md               # このファイル
```

## 🔒 Git 管理ポリシー

### 管理するファイル

- `.claude/commands/` - カスタムコマンド定義
- `.claude/skills/` - カスタムスキル
- `.claude/CLAUDE.md` - プロジェクト規約
- `.claude/.claude.json` - 設定ファイル
- `.claude/setup-plugins.sh` - セットアップスクリプト

### 除外するファイル（.gitignore）

- `.claude/cache/` - キャッシュデータ
- `.claude/debug/` - デバッグログ
- `.claude/file-history/` - ファイル履歴
- `.claude/history.jsonl` - 会話履歴
- `.claude/shell-snapshots/` - シェルスナップショット
- `.claude/stats-cache.json` - 統計キャッシュ
- `.claude/plugins/cache/` - プラグインキャッシュ

## 📖 ドキュメント

- [コマンド一覧](.claude/commands/README.md)
- [プロジェクト規約](.claude/CLAUDE.md)

## 🤝 コントリビューション

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'feat: add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. Pull Request を作成

### コミット規約

Conventional Commits を使用：

- `feat:` - 新機能
- `fix:` - バグ修正
- `docs:` - ドキュメント変更
- `refactor:` - リファクタリング
- `test:` - テスト追加・修正
- `chore:` - その他の変更

## 📝 ライセンス

Private repository - All rights reserved

## 👤 メンテナー

[@boku-miyaji](https://github.com/boku-miyaji)
