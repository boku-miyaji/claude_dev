# アジェンダ生成とAIチャットの実装方式分離

- **type**: `decision`
- **date**: 2026-04-25
- **category**: architecture / **severity**: high
- **status**: active
- **source**: detector
- **tags**: rikyu, llm-prompt, agent-harness, auto-detected, daily-batch, llm-classified

## what_happened
rikyu PJのオーケストレーション設計について、アジェンダ生成フローはmagentic_pipeline.pyスタイル（決定論的パイプライン）、AIチャットはdynamicオーケストレーション（LLM判断）と用途別に分離する方針を決定した。

## result
決定論的処理とLLM判断処理を明確に切り分ける実装指針が確立

<!-- id: 00702e3b-c69c-4f84-95e4-225845cb55d5 -->
