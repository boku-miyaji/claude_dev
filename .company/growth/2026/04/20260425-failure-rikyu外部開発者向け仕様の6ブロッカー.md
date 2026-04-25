# rikyu外部開発者向け仕様の6ブロッカー

- **type**: `failure`
- **date**: 2026-04-25
- **category**: process / **severity**: high
- **status**: active
- **source**: detector
- **tags**: rikyu, communication, auto-detected, daily-batch, llm-classified

## what_happened
rikyu案件で外部開発者が詰まる6つのブロッカーを確認: (1)インフラ設定なし(Azure/Bicep/Docker未定義) (2)バックエンドフレームワーク未定 (3)LLMプロンプトテンプレート欠落(AG1〜AG4) (4)RAG/ナレッジベース構築手順なし (5)DDL未整備 (6)CI/CD・監視未整備。仕様書として外部開発者へ渡せる状態になっていない。

## root_cause
PoC段階で社内向け前提の仕様しか作っておらず、外部開発委託を想定した記述粒度に達していない

<!-- id: 47e45b76-8dc0-4c8a-b725-27efb23d8875 -->
