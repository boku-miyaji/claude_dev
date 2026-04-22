# Hook内プロンプト分類が無限ループ

- **type**: `failure`
- **date**: 2026-04-21
- **category**: process / **severity**: medium
- **status**: recurring
- **source**: manual
- **tags**: auto-detected, daily-batch
- **parent_id**: `4d092e0e-2ab7-4930-8c5a-766b08114961`

## what_happened
同一の[correction]シグナル（プロンプト分類指示）が35回連続で発火し、毎レスポンスごとに同じ分類処理が繰り返された

## root_cause
growth-detector等のHookがUserPromptSubmitまたはStopイベントで毎回プロンプト分類を試行し、その出力自体が再度Hookをトリガーするか、分類結果の書き込み失敗で毎回リトライしている可能性が高い。Hookの冪等性チェックまたは処理済みフラグが欠如している

## countermeasure
growth-detector Hookに処理済みプロンプトIDの重複チェックを追加する。具体的には: (1) growth-signals.jsonlに書き込み済みのprompt_idをチェックし同一IDはスキップ、(2) Hookの実行間隔にdebounce（最低数秒）を入れる、(3) correction シグナルの発火条件を見直し、Hook自身の出力がトリガーにならないようフィルタする

<!-- id: 21c2b0ff-641b-4890-ad47-5641847c4d94 -->
