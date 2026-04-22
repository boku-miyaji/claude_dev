# コミット先リポジトリ判定ルールをCLAUDE.mdに明記

- **type**: `countermeasure`
- **date**: 2026-03-24
- **category**: process / **severity**: high
- **status**: active
- **source**: llm-retroactive
- **tags**: claude-dev, llm-retroactive, llm-classified

## what_happened
claude_dev誤コミット問題を受け、.claude/CLAUDE.mdに「コミット前に作業ディレクトリ内に独立した.gitがないか確認すること」「claude_devは横断基盤なので個別PJ固有のコードはコミット禁止」という恒久ルールを追加。circuit_diagram/、project-*/等の独自リポジトリを持つサブディレクトリへの正しいコミット先指定を明記した。

## countermeasure
コミット前にgit -C <dir> remote -v でリポジトリ確認を必須化。.gitignoreされているサブディレクトリは独立リポジトリの可能性を疑う。

## result
rules/commit-rules.mdにリポジトリ判定ルールが恒久化された。

<!-- id: 4db0a233-3960-4420-b39e-c1b8c21288fb -->
