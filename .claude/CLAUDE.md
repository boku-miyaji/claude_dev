# claude_dev — PJ横断開発基盤

## LLM Agent 基本原則

- [ultrathink] 実装する前に必ず設計をする。
- [ultrathink] **新しい import を追加する前に、必ず既存のコードでそのモジュールがどうインポートされているか確認する**
- [ultrathink] 実装する際はテストコードを作成し、デグレがないことを確認できるようにする。
- 実装後は必ず docs を最新化する。
- 実装したら必ず commit する。
- **IMPORTANT: TodoWriteでタスク作成時、最後のステップに「Blueprint更新確認」を必ず含める。** 実装変更があれば `company-dashboard/src/pages/Blueprint.tsx` の該当セクションを確認・更新してからタスクをdoneにする。

## ルール参照

詳細なルールは `.claude/rules/` に分割されており、Claude Code が文脈に応じて自動読み込みする:

| ルールファイル | 内容 |
|---------------|------|
| `commit-rules.md` | コミット規約、リポジトリ判定、PRチェックリスト |
| `coding-style.md` | コーディング規約、新機能ワークフロー |
| `knowledge-accumulation.md` | ナレッジ蓄積・昇格ルール |
| `skill-management.md` | スキル追加・同期・整合性チェックのルール |
| `scratch-workspace.md` | モックアップ・壁打ち資料は必ず `scratch/` に置く（git管理外） |
| `prefer-native-tools.md` | Bash合成コマンドの前に Read/Glob/Grep で代替できないか確認 |

## Compact Instructions

Context Compaction 後に必ず保持すべき情報:
- 現在実行中のパイプライン（A/B/C/D/E）とそのステップ
- 処理中のタスクID（Supabase tasks テーブル）
- チェックポイントの状態（承認済み/待ち）
- 直前の社長の指示の要約
