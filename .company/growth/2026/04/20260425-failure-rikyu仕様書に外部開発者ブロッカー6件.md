# rikyu仕様書に外部開発者ブロッカー6件

- **type**: `failure`
- **date**: 2026-04-25
- **category**: process / **severity**: high
- **status**: active
- **source**: detector
- **tags**: rikyu, documentation, llm-prompt, auto-detected, daily-batch, llm-classified

## what_happened
rikyu案件の外部開発者向け仕様書に重大な欠落が6点判明。インフラ設定（Azure Bicep/Terraform/Docker）、バックエンドフレームワーク選定、AG1〜AG4のLLMシステムプロンプト、RAG/ナレッジベース構築手順、DDL定義、CI/CDパイプラインがすべて未整備で、外部開発者が着手できない状態。

## root_cause
仕様書策定時に実装着手レベルの粒度まで詰めず、概念設計のまま外部に渡す前提になっていた

<!-- id: 95e60d3d-9cfb-484a-b138-1391242c8f68 -->
