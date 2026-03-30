# claude_dev — PJ横断開発基盤

## LLM Agent 基本原則

- [ultrathink] 実装する前に必ず設計をする。
- [ultrathink] **新しい import を追加する前に、必ず既存のコードでそのモジュールがどうインポートされているか確認する**
- [ultrathink] 実装する際はテストコードを作成し、デグレがないことを確認できるようにする。
- 実装後は必ず docs を最新化する。
- 実装したら必ず commit する。

## ルール参照

詳細なルールは `.claude/rules/` に分割されており、Claude Code が文脈に応じて自動読み込みする:

| ルールファイル | 内容 |
|---------------|------|
| `commit-rules.md` | コミット規約、リポジトリ判定、PRチェックリスト |
| `coding-style.md` | コーディング規約、新機能ワークフロー |
| `knowledge-accumulation.md` | ナレッジ蓄積・昇格ルール |
