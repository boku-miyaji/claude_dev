# 1ファイルSPA → React+TypeScript移行

- **type**: `milestone`
- **date**: 2026-04-01
- **category**: architecture / **severity**: critical
- **status**: resolved
- **source**: manual
- **tags**: architecture, react, typescript, migration, vite, claude-dev
- **commits**: dcad590, 7bccee5, b834c30, 6989f6f, df8c71d, d050954

## what_happened
Phase 1 で「1ファイルSPA」として始めたダッシュボードが 8000行超に膨張。新機能追加のたびに意図しない副作用が発生し、legacy.ts の保守が困難になっていた。

## root_cause
初期の「Claude Codeで1回で読める」という利点が、コード量の増大で逆にボトルネックに。型安全性の欠如もバグの温床に。

## countermeasure
Vite + React + TypeScript で段階的に移行。Phase 0(スキャフォールド) → Phase 1(Shell+Auth) → Phase 2(共通UI) → Phase 3(カスタムhooks) → Phase 4(ページ移行) の5段階で実行。legacy.ts はブリッジ経由で共存させつつ段階的に縮小。

## result
型安全性・コンポーネント分離・状態管理(Zustand)が確立。新機能の追加速度が大幅に向上。「最初は1ファイル、育ったら分離」という成長パターンの実例。

<!-- id: b5601af6-3ad9-48f4-b590-b5eb6e993f4b -->
