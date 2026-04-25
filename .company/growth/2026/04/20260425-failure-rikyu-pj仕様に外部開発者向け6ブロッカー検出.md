# rikyu PJ仕様に外部開発者向け6ブロッカー検出

- **type**: `failure`
- **date**: 2026-04-25
- **category**: architecture / **severity**: high
- **status**: active
- **source**: detector
- **tags**: rikyu, infrastructure, llm-prompt, auto-detected, daily-batch, llm-classified

## what_happened
外部開発者が手をつけられない6ブロッカーを特定: ①インフラ設定未定義(Bicep/Terraform/Docker無し) ②バックエンドFW未定(Node/.NET/Python) ③AG1〜AG4のLLMプロンプトテンプレ完全欠落 ④RAG/ナレッジベース構築手順なし(埋め込み・チャンク・ベクトルDB未定) ⑤セキュリティ・CI/CD未整備 ⑥仕様の不整合

## root_cause
仕様書がプロダクト要件中心で、実装に必要な技術スタック・インフラ・プロンプト・パイプラインの具体が空欄のまま

<!-- id: d36517cd-4f52-499a-bc4f-12b185329067 -->
