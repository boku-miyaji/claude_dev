# GNN V3パイプラインで部品欠落100%検出・自動修正を達成

- **type**: `milestone`
- **date**: 2026-03-25
- **category**: architecture / **severity**: high
- **status**: active
- **source**: backfill
- **tags**: GNN, 回路図生成, V3パイプライン, 粒度設計
- **commits**: b688a54

## what_happened
回路図生成パイプラインV3において、GNNがブロック内部の欠落部品（フライバックダイオード、フィルタコンデンサ等）を100%検出し、LLM設計回路に自動追加する仕組みが動作。品質改善エンジンとして機能することを確認した。

## root_cause
V2のブロック間GNNは検出のみで修正に繋がらず効果がなかったが、粒度をブロック内部品レベルに変えたことで検出→自動修正のループが成立した。

## countermeasure
GNNの適用粒度をブロック間からブロック内部品レベルに変更し、検出結果を自動追加アクションに接続した。

## result
部品検出率100%・自動追加動作。KiCad ERCの111件エラーはkicad-sch-api×KiCad9の互換性問題でロジック起因ではないと切り分け済み。

<!-- id: 95a56688-a387-491d-85b2-1b8f3fa52c4f -->
