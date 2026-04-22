# スコア表記を二重丸/丸/三角/バツに変更

- **type**: `countermeasure`
- **date**: 2026-04-19
- **category**: quality / **severity**: medium
- **status**: active
- **source**: llm-retroactive
- **tags**: claude-dev, ui, llm-retroactive, llm-classified

## what_happened
magenticの企業評価出力で数値スコアが提示されたが、社長から「意味わからない。解釈できない」と指摘。直感的に読める二重丸/丸/三角/バツの4段階記号表記への変更を要請。

## root_cause
定量スコアに解釈基準がなく、閾値もユーザーに不透明で意思決定に使えなかった

## countermeasure
各観点ごとに二重丸/丸/三角/バツの記号評価へ変更し、一目で良し悪しが判定できる表示に統一

<!-- id: fd19b47a-32dc-4349-82fb-aeaaeae3b76d -->
