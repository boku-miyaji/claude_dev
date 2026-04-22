# DIVE論文ベースの部品推薦Agent検証設計を精緻化

- **type**: `decision`
- **date**: 2026-04-14
- **category**: architecture / **severity**: high
- **status**: active
- **source**: llm-retroactive
- **tags**: polaris-circuit, llm-prompt, llm-retroactive, llm-classified

## what_happened
polaris-circuitの部品推薦Agentについて、DIVE論文の手法（グラフから必要情報抽出→DB構築→Agent検証ループ）を電子部品選定に応用する検証設計を精緻化。DB構造をparts/curves/data_pointsの3階層、DC/DC+LDOの2カテゴリで検証、実施項目を簡易〜本格の3段階で設定する方針。

## result
phaseA(データシート→DB構築)、phaseB(仕様→部品推薦Agent)の処理フローを定義

<!-- id: 68cf8926-82f6-453e-b53a-cecf955a04f2 -->
