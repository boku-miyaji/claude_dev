# MAF vs magentic_pipeline.py 用途切り分け議論

- **type**: `decision`
- **date**: 2026-04-25
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: rikyu, llm-prompt, auto-detected, daily-batch, llm-classified

## what_happened
MAF(Multi-Agent Framework)とmagentic_pipeline.pyの違い、ハイブリッド活用の可否を検討。claude codeのようにLLMオーケストレーションが自由に動く形が我々のPJでうまくいかない原因（プロンプト管理だけでない要因）を分析。

<!-- id: 4363d213-b734-4562-a0ce-e09733d01d3f -->
