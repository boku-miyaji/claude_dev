# rikyu 外部開発者ブロッカー6点未整備

- **type**: `failure`
- **date**: 2026-04-25
- **category**: architecture / **severity**: critical
- **status**: active
- **source**: detector
- **tags**: rikyu, architecture, llm-prompt, auto-detected, daily-batch, llm-classified

## what_happened
rikyu案件で外部開発者が詰まる6つのブロッカーが指摘された：Azure/Docker等のインフラ設定なし、バックエンドFW未定、AG1〜AG4のLLMプロンプトテンプレート完全欠落、RAG/埋め込み/ベクトルDB手順未記載、DB DDL不足、CI/CD未定義。仕様書として致命的な穴。

## root_cause
仕様書が機能要件中心で、実装基盤（インフラ・FW・プロンプト・データ層）の決定が先送りされていた

<!-- id: ebbe101f-202b-4924-bb18-cc273d3b2fc9 -->
