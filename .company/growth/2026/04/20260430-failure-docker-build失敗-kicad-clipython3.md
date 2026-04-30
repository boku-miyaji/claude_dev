# Docker build失敗 (kicad-cli/python3)

- **type**: `failure`
- **date**: 2026-04-30
- **category**: devops / **severity**: high
- **status**: active
- **source**: detector
- **tags**: polaris-circuit, docker, devcontainer, kicad, auto-detected, daily-batch, llm-classified

## what_happened
polaris-circuit-diagramのdevcontainer/Docker buildで python3 manually installed エラーとパッケージインストール不可の状況が発生。Dockerfile-with-features:115付近の kicad-cli インストールステップで失敗。複数回再現。

## root_cause
kicad8/9のバージョン依存とapt依存解決の競合可能性

<!-- id: f88df401-ce15-4955-ba13-9f11b0c9172b -->
