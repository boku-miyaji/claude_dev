# rikyu アーキ判断: pgvector/Functions連携/SSE

- **type**: `decision`
- **date**: 2026-04-25
- **category**: architecture / **severity**: high
- **status**: active
- **source**: detector
- **tags**: rikyu, architecture, supabase, auto-detected, daily-batch, llm-classified

## what_happened
本番運用前提MVPで複数のアーキ判断を確認: pgvectorで十分か(AI Search不要か)、Container Apps↔Functions連携方式(HTTP直/Service Bus/Storage Queue)、SSEの出し方、ポーリング採用の妥当性、research_bundleの定義。商品DBでニーズと商品ソリューションの一致判定も論点。

## result
壁打ちで論点整理。本番運用想定で再試行・タイムアウト設計を含む選定を要確認

<!-- id: 7d29cade-c173-4719-9736-ea1b2a0683a0 -->
