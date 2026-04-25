# rikyu仕様書に外部開発者向け6つのブロッカー

- **type**: `failure`
- **date**: 2026-04-25
- **category**: architecture / **severity**: high
- **status**: active
- **source**: detector
- **tags**: rikyu, devops, llm-prompt, auto-detected, daily-batch, llm-classified

## what_happened
rikyu PJ の仕様書に外部開発者が詰まる6つのブロッカーが存在: ①Azureインフラ定義(Bicep/Terraform/Docker)なし ②バックエンド未定(Node/.NET/Python) ③LLMプロンプトテンプレ欠落(AG1〜AG4) ④RAG/ベクトルDB構築手順なし ⑤CI/CD未整備 ⑥DDL未定義。

## root_cause
仕様書がビジネス要件中心で、開発実装に必要な技術詳細が体系化されていなかった

## result
壁打ち優先順位を「インフラ設計→pgvector用途→FastAPI明記」と整理。詳細は壁打ち翌日へ持ち越し

<!-- id: 3501e785-f38b-48f4-94a7-05e5da50d19f -->
