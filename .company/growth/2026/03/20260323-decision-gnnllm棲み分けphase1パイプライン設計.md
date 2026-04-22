# GNN/LLM棲み分けPhase1パイプライン設計

- **type**: `decision`
- **date**: 2026-03-23
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: llm-retroactive
- **tags**: polaris-circuit, documentation, llm-retroactive, llm-classified

## what_happened
論文サーベイを踏まえGNNとLLMの得意分野を粒度別に棲み分け、cktgen/autockt等既存技術との組合せで全体精度最大化するパイプラインに再設計。Tier構造・応答速度・更新タイミング・データ/暗黙知/ナレッジの整理を含む統合設計。

## result
PIPELINE_V2_DESIGN.mdおよびPHASE1_GPU_DESIGN.mdを作成。Phase1から着手、GPU検証部分は先に設計書を作りGPUサーバーへ依頼する運用。

<!-- id: 598c5b72-1813-41f1-a130-f5e96da0b493 -->
