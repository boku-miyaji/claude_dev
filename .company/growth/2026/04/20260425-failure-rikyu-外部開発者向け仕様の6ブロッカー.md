# rikyu 外部開発者向け仕様の6ブロッカー

- **type**: `failure`
- **date**: 2026-04-25
- **category**: architecture / **severity**: high
- **status**: active
- **source**: detector
- **tags**: rikyu, architecture, devops, auto-detected, daily-batch, llm-classified

## what_happened
外部開発者が詰まる6項目を検出: ①インフラ設定なし(Bicep/Terraform/Docker)②バックエンドFW未定③LLMプロンプトテンプレ欠落(AG1〜AG4)④RAG構築手順なし⑤DB DDL未整備⑥CI/CD不在。Container Apps↔Functions連携方式・SSE実装・pgvector/AI search選定・ポーリング採用妥当性も未確定。

## root_cause
MVPの粒度で詰めたが本番運用視点での実装フローが欠落

<!-- id: 9d610a66-59af-486a-bbed-a30b73a94316 -->
