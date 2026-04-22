# Prompt分類Hookが無限リトライループ

- **type**: `failure`
- **date**: 2026-04-17
- **category**: process / **severity**: medium
- **status**: active
- **source**: manual
- **tags**: auto-detected, daily-batch

## what_happened
同一の[correction]シグナル（プロンプト分類指示）が39回連続で発火。Hookが期待する出力を得られず、同じ分類リクエストを繰り返し送信し続けた

## root_cause
分類Hookの出力バリデーションまたはリトライロジックに終了条件がない。Hookが分類結果を正しくパースできず（または応答が切り詰められ）、毎回correctionとして再送している可能性が高い。プロンプトテキスト自体も途中で切れている（'rikyu/c'で切断）ことから、入力の切り詰めも一因

## countermeasure
分類Hookにリトライ上限（max 3回）とフォールバック（分類不能→uncategorizedタグ付与）を追加。また入力プロンプトが切り詰められていないか検証し、truncation閾値を見直す

<!-- id: 8cb59485-3758-4be6-b0d2-a51aaa7281b0 -->
