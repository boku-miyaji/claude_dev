# Dockerfile-with-features apt-get install 失敗

- **type**: `failure`
- **date**: 2026-04-30
- **category**: devops / **severity**: high
- **status**: active
- **source**: detector
- **tags**: polaris-circuit, docker, devcontainer, kicad, auto-detected, daily-batch, llm-classified

## what_happened
polaris-circuit-diagram の devcontainer ビルドで Dockerfile-with-features:115 行目の RUN set -eux; apt-get update && apt-get install ... が失敗。python3 が manually installed になり、依存関係が解決できず impossible situation エラーが発生した。kicad-cli の build sanity check 前で停止。

## root_cause
ベースイメージとパッケージ依存の組み合わせ問題。ARG $BASE_IMAGE が空または無効な値でデフォルト解決され、unstable distribution に近い状態になっていた可能性

<!-- id: 4d39d327-848f-483e-824d-eb3f0a86da48 -->
