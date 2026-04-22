# Managed Agents検索: keyword+reranker+LLM

- **type**: `decision`
- **date**: 2026-04-10
- **category**: architecture / **severity**: high
- **status**: active
- **source**: llm-retroactive
- **tags**: focus-you, llm-prompt, backend, llm-retroactive, llm-classified

## what_happened
#89 Managed Agentsの実装方針として、DB検索はPhase1でkeyword searchを実施し、取得結果をgpt-nanoでリランキング、最終的にメインLLMに渡す多段構成を採用。blueprintへの反映も指示された。

<!-- id: a4c69edf-a162-487e-b21b-796d6d270dab -->
