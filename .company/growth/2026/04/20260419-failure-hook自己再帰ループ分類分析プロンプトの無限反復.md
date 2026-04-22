# Hook自己再帰ループ（分類・分析プロンプトの無限反復）

- **type**: `failure`
- **date**: 2026-04-19
- **category**: process / **severity**: medium
- **status**: recurring
- **source**: manual
- **tags**: auto-detected, daily-batch
- **parent_id**: `4d092e0e-2ab7-4930-8c5a-766b08114961`

## what_happened
53件中ほぼ全てが同一の[correction]シグナル。'Classify each prompt'と'Analyze these failure signals'の2種類のプロンプトが繰り返し発火し続けている。Hookが自身の出力を入力として再トリガーする再帰ループが発生している。

## root_cause
growth-detector等のHookが発火した結果（correction分類やJSON分析要求）が、再びUserPromptSubmitまたはPostToolUseイベントとして検知され、同じHookが再発火している。Hookの出力がHookのトリガー条件に一致するため、自己参照ループになっている。

## countermeasure
Hookスクリプトに再帰防止ガードを追加する。例: 環境変数HOOK_RUNNING=1をセットし、既にセットされていたら即exitする。または、Hook自身が生成したプロンプト文字列（'Classify each prompt', 'Analyze these failure signals'）をフィルタリングして処理対象から除外する。

<!-- id: 7ab613b0-52e5-4c5c-b358-78f084863b28 -->
