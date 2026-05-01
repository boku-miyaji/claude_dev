# Service Bus 名 rikyu-dev-sbus も他テナント衝突、aces- プレフィックス追加で確定

- **type**: `failure`
- **date**: 2026-05-01
- **category**: architecture / **severity**: low
- **status**: resolved
- **source**: manual
- **tags**: rikyu, azure, service-bus, naming, documentation

## what_happened
NAMING.md 上は rikyu-dev-sbus で確定としていたが、別環境/別テナントとの衝突で実際には aces-rikyu-dev-sbus でリソース作成された。runbook / NAMING.md / PORTAL_SETUP.md / bicep / .env.local.example で名前が分散しズレが発生。

## root_cause
sb→sbus でも 6 文字で衝突しやすかった。Azure Service Bus 名前空間はグローバル一意で 4-50 字の制約。短くても長くても他で使われている可能性あり。

## countermeasure
全 docs/コードを aces-rikyu-dev-sbus に統一。bicep は aces--sbus 形式で展開（envName=dev で aces-rikyu-dev-sbus）。NAMING.md の衝突回避ルール表に「ACES プレフィックス追加」のステップを追加。Phase 1 で他リソース名前空間も衝突したら同様パターンを適用。

## result
全ドキュメント・コードで一貫。worker は SERVICE_BUS_CONNECTION_STRING 直接利用なので影響なし。

<!-- id: a6182c76-962d-4a2a-8eeb-e0e4d70389b7 -->
