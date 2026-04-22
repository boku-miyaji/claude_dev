# GNN構造限界→LLM主導+サブ回路検証方針

- **type**: `decision`
- **date**: 2026-03-22
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: llm-retroactive
- **tags**: polaris-circuit, llm-prompt, llm-retroactive, llm-classified

## what_happened
Round A 分析でノード6以上は認識率0%（CktGen の構造限界）と判明。転移学習も100%互換性ありながら逆効果（ドメイン差）。これを受け STEP4 設計書でL1=LLM分解（5ノード以下に強制）+ L2=GNN検証+代替提案+サブグラフ編集 + L3=統合という階層化アーキテクチャが採択された。

## result
STEP4_V3_TRAINING_DESIGN および STEP4_GPU_VALIDATION_DESIGN 設計書が策定され、LLM主導+GNNサブ回路バリデーションの方針で後続タスク（F/G/H）が計画された

<!-- id: 23b36e8a-1f97-4120-ae9a-71ccd8e2fcbd -->
