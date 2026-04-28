# rikyu アーキテクチャ: monorepo + FE/BE 分離 + TS統一

- **type**: `decision`
- **date**: 2026-04-28
- **category**: architecture / **severity**: high
- **status**: active
- **source**: detector
- **tags**: rikyu, architecture, monorepo, auto-detected, daily-batch, llm-classified

## what_happened
rikyu のアーキ壁打ちで、frontend/backend を独立リポではなく monorepo 構成にし、FE は共通化、BE は個別具体化する方針を決定。言語は Python ではなく TypeScript に統一する方向で合意（A1'-2 案）。

## countermeasure
monorepo 採用 + FE 共通化 / BE 個別 + TypeScript 統一（A1'-2）

<!-- id: f6c0890b-25a2-4445-a365-ffd2c39c4b33 -->
