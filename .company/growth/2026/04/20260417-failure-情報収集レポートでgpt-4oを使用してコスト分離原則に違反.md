# 情報収集レポートでgpt-4oを使用してコスト分離原則に違反

- **type**: `failure`
- **date**: 2026-04-17
- **category**: process / **severity**: medium
- **status**: active
- **source**: llm-retroactive
- **tags**: claude-dev, cost, llm-prompt, llm-retroactive, llm-classified

## what_happened
情報収集で生成したレポートの品質について社長が「ゼロから生成したのか、claude codeとの差分は何か、なぜgpt-4oを使っているのか」と疑問視。コスト分離原則（バッチ=Claude CLI）が守られていなかった。

## root_cause
バッチ処理でAPI経由のgpt-4oを呼び出していたため、コスト分離原則（バッチ=Claude CLI）に反していた

## countermeasure
バッチ処理はClaude Code CLI（claude --print）に統一し、API課金を避ける方針を徹底する

<!-- id: aa3fe70b-2ca6-4f3a-8862-fb50d72329dd -->
