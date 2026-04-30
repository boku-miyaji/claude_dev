# Dockerfile-with-features build失敗

- **type**: `failure`
- **date**: 2026-04-30
- **category**: devops / **severity**: high
- **status**: active
- **source**: detector
- **tags**: polaris-circuit, docker, devcontainer, auto-detected, daily-batch, llm-classified

## what_happened
polaris-circuit-diagramのDevcontainer build時にapt-get installが失敗。`set -eux`で早期失敗、kicad-cli versionをbuild sanity checkとして配置していた箇所でpython3関連のパッケージ依存関係が解決できず、'requested an impossible situation'エラー。

## root_cause
apt依存解決の不整合（unstable distribution参照またはbase image不整合の可能性）

<!-- id: 1d941961-4563-4278-b19b-12030d101393 -->
