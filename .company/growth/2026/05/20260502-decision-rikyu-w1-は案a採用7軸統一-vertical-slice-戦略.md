# rikyu W1 は案A採用・7軸統一 vertical slice 戦略

- **type**: `decision`
- **date**: 2026-05-02
- **category**: architecture / **severity**: high
- **status**: active
- **source**: daily-digest
- **tags**: rikyu, architecture, frontend, backend, auto-detected, daily-digest

## what_happened
rikyu MVP の W1 着手方針として、UI設計をDDLに合わせる案Aを採用し、7軸を統一した vertical slice として実装する戦略を決定。修正不可・入金日入力欄なしの請求書失敗を踏まえ、案Aで構造的に揃える方針へ。

## root_cause
DDLとUI仕様の乖離が修正不可の請求書バグなど複数の失敗を生んでいた

## countermeasure
UI設計をDDLに合わせる案Aを採用し、7軸を vertical slice で統一実装

## result
W1 の実装方針が確定し、構造的整合性を担保

<!-- id: d12f14a7-70bb-432d-b790-a7e95f76ea1a -->
