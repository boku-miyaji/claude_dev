# WBI情報が分散し設計が固まらない

- **type**: `failure`
- **date**: 2026-04-25
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: rikyu, llm-prompt, auto-detected, daily-batch, llm-classified

## what_happened
rikyu PJのWBI（Work Breakdown Item）について情報が複数箇所に分散しており、まだ整理しきれていない状態。社長から「ちゃんと考えきれていないのでは？」と指摘。MAF vs magentic_pipeline.pyのオーケストレーション設計判断も保留中。

## root_cause
WBIの集約場所と責務が定義されていない

<!-- id: 553d20b2-6279-4def-9515-5b0b5e54491a -->
