# LLM Wiki ナレッジ管理基盤の導入

- **type**: `milestone`
- **date**: 2026-04-06
- **category**: automation / **severity**: medium
- **status**: active
- **source**: backfill
- **tags**: knowledge-management, hooks, lint
- **commits**: 0197514, f1a0d20, 15a0323

## what_happened
Karpathy の LLM Wiki 構想を分析（HD方針と80%整合）した上で、index・log・daily lint からなるナレッジ管理の仕組みを導入。knowledge-lint hook と docs-sync-guard のカバレッジを7→14ファイルに拡張。

## root_cause
ナレッジが残る基盤・組織の学習が蓄積する基盤が曖昧だったため、外部事例を取り込んで整理

## countermeasure
リサーチ成果をそのまま設計に反映し、lint/guard hookで自動化

## result
ナレッジ鮮度監視の守備範囲が倍増

<!-- id: 7da006ca-b87a-433c-931b-3b6c6b8a5405 -->
