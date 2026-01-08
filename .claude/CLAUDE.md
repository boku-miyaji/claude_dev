<!-- グローバル規約とルール定義。プロジェクト側に CLAUDE.md がある場合はこちらがフォールバックになります -->

### :robot: LLM Agent Rules

- [ultrathink] 実装する前に必ず設計をする。
- [ultrathink] **新しいimportを追加する前に、必ず既存のコードでそのモジュールがどうインポートされているか確認する**
- [ultrathink] 実装する際はテストコードを作成し、デグレがないことを確認できるようにする。
- 実装後は必ず docs を最新化する。
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

### :cyclone: Workflow for New Features

1. **Planning Phase**
   - Use TodoWrite to create task list
   - Search existing patterns: `grep`, `Glob`
   - Read related files to understand architecture

2. **Implementation Phase**
   - Follow existing patterns in the codebase
   - Check TypeScript with `npm run type-check` (if applicable)
   - Verify imports are correct

3. **Completion Phase**
   - Update TodoWrite as you complete tasks
   - Update documentation if needed
   - Commit with conventional commits

4. **PR Creation Phase**
   - Create PR description in `docs/temp/pr/` directory
   - File naming: `PR_DESCRIPTION_{feature-name}.md` or `PR_DESCRIPTION_{PR-number}.md`
   - Use `gh pr create --body-file docs/temp/pr/PR_DESCRIPTION_xxx.md` for auto-populated description
   - The `docs/temp/` directory should be in `.gitignore`

### :art: Code Style

- Use TypeScript for all new code (if project uses TypeScript)
- Follow existing naming conventions
- Add JSDoc comments for complex functions
- Keep components focused and small
