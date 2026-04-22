# LLM出力は段階表示で即時性を優先

- **type**: `decision`
- **date**: 2026-04-03
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: llm-retroactive
- **tags**: focus-you, ui, llm-prompt, llm-retroactive, llm-classified

## what_happened
全部の情報が揃ってから表示する方式では遅い。LLMが出す1文とその他の生成しない情報（予定・タスク・日記等）を分離し、出せるものから先に表示する方針に変更。

## result
ブリーフィング画面のUXが即時性重視へシフト

<!-- id: 19aa5663-bc71-4c10-a140-edae40e57f34 -->
