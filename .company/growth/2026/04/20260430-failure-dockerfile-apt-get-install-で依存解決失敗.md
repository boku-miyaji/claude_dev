# Dockerfile apt-get install で依存解決失敗

- **type**: `failure`
- **date**: 2026-04-30
- **category**: devops / **severity**: high
- **status**: active
- **source**: detector
- **tags**: polaris-circuit, docker, kicad, auto-detected, daily-batch, llm-classified

## what_happened
polaris-circuit-diagram の Dockerfile ビルドで apt-get install が impossible situation エラー。kicad-cli インストール周辺で python3 関連の依存解決が破綻し、build sanity check 以前に失敗していた。

## root_cause
apt パッケージ依存関係の不整合（kicad8/9 とベースイメージの Python バージョン乖離の可能性）

<!-- id: 84a7a3d9-39a9-4991-8a4a-5349eb5bd784 -->
