# Dockerfile kicad-cli インストール失敗

- **type**: `failure`
- **date**: 2026-04-30
- **category**: devops / **severity**: high
- **status**: active
- **source**: detector
- **tags**: polaris-circuit, docker, kicad, auto-detected, daily-batch, llm-classified

## what_happened
polaris-circuit-diagram の Dockerfile で apt-get install --no-install-recommends による kicad-cli インストールが失敗。python3 set to manually installed エラーと共に、impossible situation または unstable distribution 由来のパッケージ依存解決失敗が発生。kicad8/9 のバージョン互換性も論点に。

## root_cause
apt の依存関係解決失敗（unstable パッケージ混在 or kicad バージョン指定問題）

<!-- id: 42428da5-e594-46e4-9be1-eca13270ab75 -->
