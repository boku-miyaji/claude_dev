# Hook自己再帰ループ（growth-detector）

- **type**: `failure`
- **date**: 2026-04-19
- **category**: process / **severity**: medium
- **status**: active
- **source**: manual
- **tags**: auto-detected, daily-batch

## what_happened
56件のfailure signalの全てが同じ2パターンの繰り返し: (1) 'Classify each prompt...' (2) 'Analyze these failure signals...'。Hook が自身の出力を [correction] として再検出し、無限ループが発生している

## root_cause
growth-detector または skill-evolution hook が、Hook自身が生成したプロンプト（分類指示・分析指示）をユーザーの correction として誤検出している。Hook出力 → correction検出 → 分析プロンプト生成 → それも correction検出 → 再帰

## countermeasure
Hook のプロンプト検出ロジックに自己参照フィルタを追加する。具体的には: (1) hook自身が生成したプロンプトを除外するマーカー（例: x-hook-generated ヘッダや特定プレフィックス）を付与、(2) 'Classify each prompt' や 'Analyze these failure signals' のような hook テンプレート文字列をブラックリストに追加、(3) 同一内容の signal が短時間に3回以上出たら dedup して打ち切る

<!-- id: f0742325-a01c-49ac-b1f3-e587275fd547 -->
