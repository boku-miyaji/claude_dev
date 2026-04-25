# rikyu外部開発者向け6つの仕様ブロッカーが発覚

- **type**: `failure`
- **date**: 2026-04-25
- **category**: architecture / **severity**: high
- **status**: active
- **source**: detector
- **tags**: rikyu, llm-prompt, auto-detected, daily-batch, llm-classified

## what_happened
rikyu案件で外部開発者が詰まる6つのブロッカーを特定: インフラ設定（Bicep/Terraform/Docker）未整備、バックエンドFW未定、LLMプロンプトテンプレート（AG1〜AG4）欠落、RAG/ナレッジベース構築手順なし、評価ハーネスなし、CI/CD未整備。これらが揃わないと外部開発者に渡せない状態

## root_cause
外部開発者向けの仕様策定が不十分。インフラ・プロンプト・DDL・CI/CD等の周辺資料が網羅的に抜けていた

<!-- id: 96ee53da-2be5-4f2f-83a3-df7bced4d14c -->
