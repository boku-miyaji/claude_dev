# KiCad 8でDockerビルド失敗・Dockerfile警告

- **type**: `failure`
- **date**: 2026-04-30
- **category**: devops / **severity**: high
- **status**: active
- **source**: detector
- **tags**: polaris-circuit, docker, kicad, auto-detected, daily-batch, llm-classified

## what_happened
polaris-circuitのDevContainer/Dockerビルドで `InvalidDefaultArgInFrom: Default value for ARG $BASE_IMAGE results in empty or invalid base image name` 警告と、KiCad関連パッケージの依存関係が解決できないエラーが発生。KiCad 8ではなくKiCad 9が必要かの確認も含めて議論。

## root_cause
Dockerfile の ARG $BASE_IMAGE のデフォルト値が空、加えてKiCad 8の依存パッケージがUnstable distributionで解決不能

<!-- id: 333019ae-40f2-4271-a2d1-e4639e0ffc27 -->
