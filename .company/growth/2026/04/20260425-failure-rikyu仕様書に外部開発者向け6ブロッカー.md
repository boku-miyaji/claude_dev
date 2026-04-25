# rikyu仕様書に外部開発者向け6ブロッカー

- **type**: `failure`
- **date**: 2026-04-25
- **category**: architecture / **severity**: high
- **status**: active
- **source**: detector
- **tags**: rikyu, specification, infrastructure, llm-prompt, auto-detected, daily-batch, llm-classified

## what_happened
rikyuプロジェクトの仕様書が外部開発者にとって実装不能な状態。6つのブロッカーが判明: (1)インフラ設定なし(Azure Bicep/Terraform/Docker未定義)、(2)バックエンドFW未定(Node/.NET/Python不明)、(3)LLMプロンプトテンプレート完全欠落(AG1〜AG4)、(4)RAG/ナレッジベース構築手順なし(埋め込みモデル/チャンク/ベクトルDB未定義)、(5)テスト戦略なし、(6)CI/CD未整備。

## root_cause
仕様書が機能要件中心で、実装に必要な技術スタック・インフラ・プロンプト・運用設計が欠落

<!-- id: 1b4c314f-67b5-4bf9-9540-48ce52fc67fd -->
