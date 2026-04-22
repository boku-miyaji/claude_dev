# V3部品レベルGNNパイプライン採用

- **type**: `decision`
- **date**: 2026-03-25
- **category**: architecture / **severity**: high
- **status**: active
- **source**: llm-retroactive
- **tags**: polaris-circuit, llm-retroactive, llm-classified

## what_happened
GNN検証でV2のブロック間GNNは効果が出ず、粒度が不適切と判明。V3はL1(LLM)→L3(BOM展開)→L2'(GNN)の順で部品粒度の二部グラフ(部品↔ネット)を使う設計に変更。ノード特徴も30次元one-hotから384次元テキスト埋め込みに刷新。

## root_cause
GNNはブロック粒度では構造情報が粗すぎて学習シグナルにならず、部品粒度で初めて意味を持つ

## result
V3設計書としてPIPELINE_V3_COMPONENT_LEVEL_DESIGN.mdに確定

<!-- id: 0de25eb5-5b12-4407-a30d-57ef0192a4fd -->
