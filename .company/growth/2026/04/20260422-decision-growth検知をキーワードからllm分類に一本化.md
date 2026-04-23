# growth検知をキーワードからLLM分類に一本化

- **type**: `decision`
- **date**: 2026-04-22
- **category**: architecture / **severity**: high
- **status**: active
- **source**: daily-digest
- **tags**: claude-dev, automation, llm-prompt, auto-detected, daily-digest
- **commits**: 58b1dbc, dd45a02, 32f8f0c, 75fe999, f580919

## what_happened
growth-detectorのキーワード判定を廃止し、daily-batchでClaude CLI (opus) による分類 (failure/countermeasure/decision/milestone/noise) に一本化。3/26〜4/21の全プロンプトをLLM再分類でバックフィル。null byte混入のINSERTエラーも併せて修正。

## root_cause
キーワード判定ではgrowthイベントの見逃しが多く、拾う精度も低かった。分類判断はLLMの得意領域に寄せるべきだった。

## countermeasure
Hookは全プロンプトをraw で growth-signals.jsonl に蓄積するだけに責務を限定し、分類はDaily batchでClaude CLI opusが担う構造に再設計。

## result
source='detector'の精度向上と、過去約1ヶ月分のバックフィル完了。キーワード保守からの解放。

<!-- id: c24884bf-6484-46eb-834c-30b003a3a190 -->
