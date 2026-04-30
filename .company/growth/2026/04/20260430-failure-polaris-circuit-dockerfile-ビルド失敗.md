# polaris-circuit Dockerfile ビルド失敗

- **type**: `failure`
- **date**: 2026-04-30
- **category**: devops / **severity**: high
- **status**: active
- **source**: detector
- **tags**: polaris-circuit, docker, devcontainer, auto-detected, daily-batch, llm-classified

## what_happened
polaris-circuit-diagram の devcontainer ビルドで apt パッケージ依存衝突が発生。`Some packages could not be installed` / `requested an impossible situation` エラー。kicad-cli のバージョン（kicad8 vs 9）も論点になり、`set -eux` での早期失敗が顕在化。

## root_cause
apt パッケージの依存関係不整合 / kicad バージョン選定の検証不足

<!-- id: 10a8baed-847d-4a00-ae06-0f21a20978d2 -->
