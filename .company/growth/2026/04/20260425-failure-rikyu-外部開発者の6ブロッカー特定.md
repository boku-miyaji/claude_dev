# rikyu 外部開発者の6ブロッカー特定

- **type**: `failure`
- **date**: 2026-04-25
- **category**: architecture / **severity**: critical
- **status**: active
- **source**: detector
- **tags**: rikyu, architecture, llm-prompt, auto-detected, daily-batch, llm-classified

## what_happened
rikyu PJで外部開発者が詰まる6つのブロッカーが判明。インフラ設定（Azure Bicep/Terraform/Docker）、バックエンドフレームワーク未定、LLMプロンプトテンプレート（AG1〜AG4）欠落、RAG/ナレッジベース構築手順未記載、DB DDL未整備、Container Apps↔Functions連携方式未定。MVPと言いつつ本番運用想定のため重大。

## root_cause
設計書がAzureリソース定義・実装フロー・プロンプト管理レベルまで降りていない。商品DBのニーズ-ソリューション一致設計も不足

<!-- id: 5dab4d99-7fa8-4228-ab30-3fcf8055045c -->
