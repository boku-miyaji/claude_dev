# rikyu W1 は案A採用・7軸統一・Vertical Slice 戦略

- **type**: `decision`
- **date**: 2026-05-02
- **category**: architecture / **severity**: high
- **status**: active
- **source**: detector
- **tags**: rikyu, ui, ddl, auto-detected, daily-batch, llm-classified

## what_happened
PoC UI が体験設計を反映しきれていない問題に対し、UI 流用 vs 再設計を議論。マッパー方式は「夫妻になる」ため拒否し、DDL/UI のどちらかに根本的に揃える方針を確認。案A（全機能を見せる）を採用、7軸命名規則統一・Vertical Slice 戦略で W1 を push（4 commits: 91ea462 → f2b28f2）。

## result
mvp/docs/SESSION_2026-05-01_W1_HANDOFF.md (370行/11セクション) に引き継ぎ資料を作成、store.tsx 17メソッド改修プラン込み。

<!-- id: bf082c4c-2e1c-4ae9-8284-5ad24090a914 -->
