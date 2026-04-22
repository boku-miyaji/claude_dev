# GPU対応devcontainer環境の追加

- **type**: `milestone`
- **date**: 2025-12-09
- **category**: devops / **severity**: medium
- **status**: active
- **source**: backfill
- **tags**: devcontainer, gpu, docker, 開発環境
- **commits**: fd6a463

## what_happened
既存のdevcontainer構成にGPU版を追加し、CPU版とGPU版を切り替え可能な構成へ再編。Dockerfileとdevcontainer.jsonをcpu/gpu別に分割し、READMEも整備。7ファイル529行の追加で開発環境の選択肢を拡張。

## result
CPU/GPU環境を用途に応じて使い分け可能に

<!-- id: 4a12f464-ace0-451c-8f79-873a040766c7 -->
