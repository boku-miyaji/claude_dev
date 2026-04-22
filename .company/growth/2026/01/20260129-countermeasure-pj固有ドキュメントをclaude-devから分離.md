# PJ固有ドキュメントをclaude_devから分離

- **type**: `countermeasure`
- **date**: 2026-01-29
- **category**: organization / **severity**: medium
- **status**: active
- **source**: backfill
- **tags**: repository-boundary, gitignore, revert, project-rikyu, rikyu
- **commits**: 33e8662, ccabbe6, 4ce2d86

## what_happened
NTTData PoC2差別化戦略など15,646行のproject-rikyu-sales-proposals-poc関連ドキュメントを一旦コミットしたが、claude_devはPJ横断基盤リポジトリであるためRevertし、.gitignoreに追加して独立管理へ切り替えた。

## root_cause
PJ固有の成果物をclaude_devに直接コミットしてしまった。リポジトリ責務の境界判断ミス。

## countermeasure
Revertコミットで差し戻し、.gitignoreにproject-rikyu-sales-proposals-pocを追加して以後混入を防止。

## result
claude_devのクリーン性を維持。PJ固有ドキュメントは別リポジトリで管理する方針を再確認。

<!-- id: 06877116-2f53-43b2-b2aa-4c5a5ed17cec -->
