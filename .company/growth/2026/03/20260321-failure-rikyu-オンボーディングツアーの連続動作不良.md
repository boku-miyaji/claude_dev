# rikyu オンボーディングツアーの連続動作不良

- **type**: `failure`
- **date**: 2026-03-21
- **category**: quality / **severity**: high
- **status**: active
- **source**: llm-retroactive
- **tags**: rikyu, ui, frontend, llm-retroactive, llm-classified

## what_happened
アジェンダ詳細画面で「次へ」ボタンが反応しない、ハイライト位置が一瞬別の場所に出る、商談記録のハイライトが違う場所を指す、青いリンクという文言が不明瞭、など複数画面でツアーが破綻。同じ「次へが効かない」問題で最低3回の修正試行が発生。

## root_cause
全体の動作確認なしに部分修正を繰り返した。動線とハイライト対象セレクタの整合性を事前検証していなかった。

## countermeasure
オンボーディングストーリー全体を設計し直し、社長レビューを通してから実装する方針に切替。

<!-- id: 9bf62cf3-e174-4972-a957-12e829c576ef -->
