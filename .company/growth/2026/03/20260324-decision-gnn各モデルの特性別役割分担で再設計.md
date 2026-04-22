# GNN各モデルの特性別役割分担で再設計

- **type**: `decision`
- **date**: 2026-03-24
- **category**: architecture / **severity**: high
- **status**: active
- **source**: llm-retroactive
- **tags**: polaris-circuit, llm-prompt, llm-retroactive, llm-classified

## what_happened
ルールベース13種を排除し、各モデルの得意領域に合わせた役割分担で再設計する方針を決定。GCN→BOM部品追加、GAT→LLM接続確認、CktGen VAE→代替提案、LLM→評価とFB生成。「GNNというよりは各モデルの特性にあったところを実施するのがいい」という社長判断に基づき、run_full_pipeline_v2.pyの実装に進んだ。

## result
GAT+ルール+GCN+CktGen VAEの4層が役割を分担する構成で実装着手。

<!-- id: c5614352-5155-4042-9005-95031bde2a54 -->
