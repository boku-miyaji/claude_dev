---
name: high
description: この応答だけ effort level を high にオーバーライドする。知能とコストのバランス重視。`/high <instruction>` の形で使う。
effort: high
disable-model-invocation: true
---

# High Effort Override

この応答では high effort level で処理する（xhigh よりトークン節約）。
skill が終わると元の session effort level に戻る。

## タスク

$ARGUMENTS
