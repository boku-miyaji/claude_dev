# claude_devにcircuit_diagram関連ファイル誤コミット

- **type**: `failure`
- **date**: 2026-03-24
- **category**: process / **severity**: high
- **status**: active
- **source**: llm-retroactive
- **tags**: claude-dev, llm-retroactive, llm-classified

## what_happened
PJ横断開発基盤であるclaude_devに、polaris-circuit固有のGNN検証コードや実装ファイルを誤ってコミットしてしまった。社長から「claude_devリポジトリにはコミットしないで」「全部のコミットをcircuit_diagramのリポジトリに移してください」と指摘を受けた。

## root_cause
サブディレクトリ内に独立した.gitがあるかを確認せず、外側のclaude_devリポジトリにコミットしていた。リポジトリの責務分離（横断基盤vs個別PJ）の意識不足。

<!-- id: 1e793b2c-1956-45ec-82df-ce13f861e383 -->
