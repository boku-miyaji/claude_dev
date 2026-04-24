# rikyu: Supabase不使用+Python+Azure構成

- **type**: `decision`
- **date**: 2026-04-24
- **category**: architecture / **severity**: high
- **status**: active
- **source**: detector
- **tags**: rikyu, azure, python, auto-detected, daily-batch, llm-classified

## what_happened
rikyu PJのアーキテクチャ検討で、Supabase Edge Functions は使わず、LLM処理は Python で書くことを明確化。デプロイ先は Azure Container Apps か Azure Functions の二択で比較検討中。focus-you の構成（Supabase+TS）とは完全に分離する。

## result
Python + Azure 基盤で進める方向で合意。Container Apps vs Functions の選定は継続検討

<!-- id: 79f27000-be32-4003-9ef7-0d787b6a4db1 -->
