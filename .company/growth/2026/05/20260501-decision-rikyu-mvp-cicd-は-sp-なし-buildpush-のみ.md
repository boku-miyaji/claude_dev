# rikyu MVP CI/CD は SP なし build/push のみ

- **type**: `decision`
- **date**: 2026-05-01
- **category**: devops / **severity**: medium
- **status**: active
- **source**: daily-digest
- **tags**: rikyu, ci-cd, operations, auto-detected, daily-digest

## what_happened
ACES PC でないと操作できない権限があることを踏まえ、rikyu MVP の CI/CD 方針を整理。Service Principal を使わず、build/push のみ GitHub Actions で自動化し、deploy は手動 portal 操作とする方針を決定。

## root_cause
Azure ロール割り当て権限不足・ACES 配下リソースの操作制限により、Service Principal 経由の自動 deploy が現実的でないため

## countermeasure
build/push 自動化 + 手動 deploy のハイブリッド構成を採用

## result
権限制約下でも CI/CD パイプラインを回せる現実解として確定。

<!-- id: 3b2c554a-e4cf-4fa0-aed4-32e13353dfbb -->
