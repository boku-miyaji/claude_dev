---
name: max
description: この応答だけ effort level を max にオーバーライドする。deepest reasoning。セッション設定には影響しない。`/max <instruction>` の形で使う。
effort: max
disable-model-invocation: true
---

# Max Effort Override

この応答では max effort level で処理する（deepest reasoning、no constraint on token spending）。
skill が終わると元の session effort level に戻る。

## タスク

$ARGUMENTS
