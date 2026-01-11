<!-- グローバル規約とルール定義。プロジェクト側に CLAUDE.md がある場合はこちらがフォールバックになります -->

### :robot: LLM Agent Rules

- [ultrathink] 実装する前に必ず設計をする。
- [ultrathink] **新しい import を追加する前に、必ず既存のコードでそのモジュールがどうインポートされているか確認する**
- [ultrathink] 実装する際はテストコードを作成し、デグレがないことを確認できるようにする。
- 実装後は必ず docs を最新化する。
- 実装したら必ず commit する。

### :memo: コーディング規約（抜粋）

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

---

## :brain: ナレッジ蓄積ルール

> ユーザーとの対話から学習した知見を蓄積し、将来的にナレッジベースとして活用する。

### 蓄積先

- **ディレクトリ**: `~/.claude/knowledge/`
- **形式**: YAML（将来的に DB 化しやすい構造）

### 記録タイミング

以下のタイミングで履歴を記録する:

1. **出力への修正・フィードバック**: 出力に対する修正指示や改善要望（これが最重要）
2. **汎用的な好み・方針の表明**: ユーザーがあえて指示した、今後も適用すべき指針
3. **デフォルト挙動への修正要望**: 「こうしないで」「こうして」という恒久的な指示

### 記録しないもの

- 単なるタスク指示（「○○ を実装して」など一回限りの要求）
- 一般的な質問への回答
- プロジェクト固有の一時的な情報

### 記録内容（YAML 構造）

```yaml
# ~/.claude/knowledge/YYYY-MM-DD_topic.yaml
metadata:
  date: "YYYY-MM-DD"
  project: "プロジェクト名"
  topic: "トピック概要"

decisions:
  - id: "DEC-001"
    context: "どういう状況で"
    question: "何を決めたか"
    answer: "どう決めたか"
    reasoning: "なぜそう決めたか（推定含む）"

preferences:
  - category: "カテゴリ"
    preference: "ユーザーの好み・指針"

instructions:
  - instruction: "具体的な指示内容"
    applies_to: "適用範囲"
```

### 蓄積の活用

1. **新規プロジェクト開始時**: 過去の決定事項を参照して類似ケースを適用
2. **仕様書作成時**: ユーザーの好む構造・形式を適用
3. **設計時**: 過去の設計思想を踏まえた提案

### 注意事項

- 機密情報（API キー、パスワード等）は記録しない
- 個人情報は匿名化して記録
- 定期的にナレッジを整理・統合する（手動または指示があった時）

### CLAUDE.md への昇格ルール

ナレッジが蓄積されたら、以下の条件で CLAUDE.md への追加を**提案**する:

#### 昇格条件（いずれかを満たす場合）

1. **繰り返しパターン**: 同じカテゴリの指示・好みが **2 回以上** 記録された
2. **明示的な汎用ルール**: 「常に〜する」「必ず〜する」など恒久的なルールとして示された
3. **プロジェクト横断**: 複数のプロジェクトで同じ指針が適用された

#### 提案タイミング

- 新しいナレッジを記録した時に、過去のナレッジを確認
- 昇格条件を満たすパターンがあれば、セッション終了時に提案

#### 提案形式

```
📋 CLAUDE.md 昇格提案

以下のナレッジが繰り返し記録されています。CLAUDE.mdに追加しますか？

【カテゴリ】仕様書作成
【内容】構造化する前に元ドキュメントをoriginal/に保存する
【出現回数】2回（2025-01-11, 2025-01-15）

追加する場合は「追加して」と指示してください。
```

#### 昇格後の処理

- CLAUDE.md の該当セクションに追加
- 元のナレッジファイルに `promoted_to_claude_md: true` フラグを追加
