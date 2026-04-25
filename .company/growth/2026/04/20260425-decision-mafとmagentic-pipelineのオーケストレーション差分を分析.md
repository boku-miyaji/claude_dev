# MAFとmagentic_pipelineのオーケストレーション差分を分析

- **type**: `decision`
- **date**: 2026-04-25
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: rikyu, llm-prompt, auto-detected, daily-batch, llm-classified

## what_happened
Multi-Agent Framework（MAF）と magentic_pipeline.py のアーキテクチャを比較。Claude CodeのようにLLMが自由にオーケストレーションする方式と、明示的なパイプライン方式の違いを議論。プロンプト管理の精度が成否を分けるかを検討。WBI情報の分散も論点に

<!-- id: 6ff35fd4-3328-469f-9608-f2c984e3e843 -->
