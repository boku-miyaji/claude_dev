# Hook分類・分析プロンプトの無限再帰ループ

- **type**: `failure`
- **date**: 2026-04-19
- **category**: process / **severity**: medium
- **status**: recurring
- **source**: manual
- **tags**: auto-detected, daily-batch
- **parent_id**: `4d092e0e-2ab7-4930-8c5a-766b08114961`

## what_happened
158件中大半が同一の「Classify each prompt」「Analyze these failure signals」の繰り返し。Hookが自身の出力をトリガーとして再発火し、correction信号が雪だるま式に増殖している

## root_cause
growth-detector等のHookが生成した分類/分析プロンプト自体が再びHookのUserPromptSubmitイベントを発火させ、再帰ループが発生。Hookの出力がHookの入力になる自己参照構造

## countermeasure
Hook内で「Hook自身が生成したプロンプト」を検出してスキップするガード条件を追加する。例: プロンプト先頭が'Classify each prompt'や'Analyze these failure signals'にマッチしたら即return 0。または環境変数HOOK_ORIGINATED=1をセットして再帰を防止する

<!-- id: d39dc464-2be3-4e72-9c09-e169e098bea7 -->
