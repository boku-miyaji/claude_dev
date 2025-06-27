<!-- グローバル規約とルール定義。プロジェクト側に CLAUDE.md がある場合はこちらがフォールバックになります -->

### :memo: コーディング規約（抜粋）

- コードコメントは **英語**で書く
- commit メッセージは Conventional Commits
  - `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:` …
- ブランチ命名: `task/{ISSUE-ID}-{slug}` 例) `task/123-user-search-ui`

### :clipboard: PR レビュー・チェックリスト

1. テストは追加されているか
2. 破壊的変更がある場合、README / MIGRATION に記載したか
3. 新規依存は license & size を確認したか

### :robot: LLM Agent Rules

```mdc
#import https://raw.githubusercontent.com/steipete/agent-rules/main/global-rules.mdc
```

### :bulb: ベストプラクティス

- 大きな変更は `/flow:spawn-sparc architect` で設計レビューを先に通す
- push 前に `/monitor:token --plan max10` を実行してトークン使用量を確認
