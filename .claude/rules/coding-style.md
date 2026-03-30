---
description: コーディング規約・スタイルガイド。コード編集時に自動適用。
globs: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.py"]
---

# コーディング規約

- Use TypeScript for all new code (if project uses TypeScript)
- Follow existing naming conventions
- Add JSDoc comments for complex functions
- Keep components focused and small

## 新機能ワークフロー

1. **Planning**: TaskCreate でタスク整理 → 既存パターン検索 → 関連ファイル読み込み
2. **Implementation**: 既存パターンに従う → 型チェック → import 確認
3. **Completion**: タスク更新 → ドキュメント更新 → Conventional Commits でコミット
4. **PR Creation**: `docs/temp/pr/PR_DESCRIPTION_{feature-name}.md` に記述 → `gh pr create --body-file` で作成
