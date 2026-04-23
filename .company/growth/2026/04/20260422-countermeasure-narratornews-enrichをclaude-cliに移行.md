# narrator/news-enrichをClaude CLIに移行

- **type**: `countermeasure`
- **date**: 2026-04-22
- **category**: devops / **severity**: medium
- **status**: active
- **source**: daily-digest
- **tags**: claude-dev, cost, llm-prompt, auto-detected, daily-digest
- **commits**: 9b453c3

## what_happened
バッチ処理の narrator-update と news-enrich が OpenAI API を直接叩いていたのを Claude CLI (opus) 呼び出しに移行。コスト分離の原則（ダッシュボード=nano/バッチ=Claude CLI/Hook=API禁止）に既存バッチを整合させた。

## root_cause
コスト分離の原則は既にdecisionとして記録されていたが、既存バッチがAPI直叩きのままで未適用だった

## countermeasure
`claude --print` ベースの呼び出しに書き換え、API課金を回避

## result
コスト分離原則を主要バッチに波及、API課金削減

<!-- id: ed63d174-f2a0-407e-97a6-d2e4722ae932 -->
