# rikyu PJ仕様の6ブロッカー判明

- **type**: `failure`
- **date**: 2026-04-25
- **category**: process / **severity**: high
- **status**: active
- **source**: detector
- **tags**: rikyu, documentation, auto-detected, daily-batch, llm-classified

## what_happened
外部開発者が詰まる6つのブロッカーが指摘された：(1)Azure Bicep/Docker等のインフラ設定なし (2)バックエンドFW未定 (3)AG1〜AG4のLLMプロンプトテンプレート完全欠落 (4)RAG/ベクトルDB構築手順なし (5)DB DDLなし (6)CI/CDなし。仕様書として不完全。

## root_cause
プロダクト設計のみで実装着手に必要な技術仕様の明文化を後回しにしていた

<!-- id: 33533987-f33d-4f7c-b998-ec1f18cd1dfb -->
