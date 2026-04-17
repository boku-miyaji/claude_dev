---
name: med
description: この応答だけ effort level を medium にオーバーライドする。コスト重視でトークン使用を抑える。`/med <instruction>` の形で使う。
effort: medium
disable-model-invocation: true
---

# Medium Effort Override

この応答では medium effort level で処理する（コスト・レイテンシ重視）。
skill が終わると元の session effort level に戻る。

## タスク

$ARGUMENTS
