<!-- グローバル規約とルール定義。プロジェクト側に CLAUDE.md がある場合はこちらがフォールバックになります -->

### :robot: LLM Agent Rules

- [ultrathink] 実装する前に必ず設計をする。
- [ultrathink] 実装する際はテストコードを作成し、デグレがないことを確認できるようにする。
- 実装したら必ず commit する。

### :memo: コーディング規約（抜粋）

- コードコメントは **英語**で書く
- commit メッセージは Conventional Commits
  - `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:` …
- ブランチ命名: `task/{ISSUE-ID}-{slug}` 例) `task/123-user-search-ui`

### :clipboard: PR レビュー・チェックリスト

1. テストは追加されているか
2. 破壊的変更がある場合、README / MIGRATION に記載したか
3. 新規依存は license & size を確認したか
