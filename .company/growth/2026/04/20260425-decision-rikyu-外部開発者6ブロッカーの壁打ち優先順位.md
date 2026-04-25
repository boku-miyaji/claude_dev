# rikyu 外部開発者6ブロッカーの壁打ち優先順位

- **type**: `decision`
- **date**: 2026-04-25
- **category**: architecture / **severity**: high
- **status**: active
- **source**: detector
- **tags**: rikyu, azure, auto-detected, daily-batch, llm-classified

## what_happened
rikyu PJで外部開発者が詰まる6ブロッカー（インフラ未整備、バックエンドFW未定、LLMプロンプト欠落、RAG手順なし、DDL未整備、フロントエンド連携不明）の対応優先順位を協議。インフラ設計→pgvector用途→FastAPI明記の順で壁打ちすることに。

## root_cause
実装フロー（Container Apps ↔ Functions連携、SSE出し方、ポーリング/Service Bus選択）が未定義

## countermeasure
pgvectorで十分か再評価、本番運用想定でポーリングの妥当性を再検討

<!-- id: 7b1a9f80-bfef-415a-b365-29990eee49f8 -->
