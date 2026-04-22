# ブリーフィングSSEパースの連鎖障害

- **type**: `failure`
- **date**: 2026-04-01
- **category**: devops / **severity**: medium
- **status**: resolved
- **source**: manual
- **tags**: devops, sse, jwt, edge-function, error-handling
- **commits**: 3145ebe, 036f624, c9379ae, 5f45b1a, 75c3665

## what_happened
Home画面のブリーフィングが表示されない。Edge Functionへの接続、JWT認証、SSEパース、レスポンスのパースがそれぞれ別のバグを持っており、1つ直すと次が発覚する連鎖障害。

## root_cause
Edge Function呼び出し→SSEストリーミング→パース→表示という長いパイプラインの各段階にテストがなく、end-to-endでしか問題が見えなかった。

## countermeasure
JWT自動リフレッシュ、SSE deltaイベントのパース修正、2段階アーキテクチャ（即時表示→非同期LLM呼び出し）で解決。

## result
複雑なパイプラインは各段階でのエラーハンドリングが必要。「動く最短パス」を先に確保し、非同期で豊かな体験を追加する2段階アーキテクチャが有効。

<!-- id: bbf5c8f6-5251-4d99-a75d-7b5df8db40fa -->
