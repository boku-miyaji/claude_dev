---
name: low
description: この応答だけ effort level を low にオーバーライドする。最速・最安で、短く限定的なタスク向け。`/low <instruction>` の形で使う。
effort: low
disable-model-invocation: true
---

# Low Effort Override

この応答では low effort level で処理する（短くスコープされた latency-sensitive タスク向け）。
skill が終わると元の session effort level に戻る。

## タスク

$ARGUMENTS
