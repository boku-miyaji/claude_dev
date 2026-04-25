# skill大整理: 不使用skill無効化方針

- **type**: `decision`
- **date**: 2026-04-25
- **category**: organization / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: claude-dev, agent-harness, auto-detected, daily-batch, llm-classified

## what_happened
HD運用中に作成されたskillを全面見直し。1/2/3、pptx系、diary、weekly-digest、auto-prepを削除。design/zenn/tax-advisor/invoice等は維持。skill使用時に必ずカウント可能にする運用ルールを追加。

## root_cause
使われていないskillが蓄積し、エージェントへのcontext圧迫と運用判断の混乱を招いていた

## countermeasure
未使用skillの削除＋skill定義に「使用時に記録される一文」を必ず含める運用化

## result
skill選定基準と使用計測の仕組みを整備

<!-- id: 05407dce-8daa-481e-ae04-36c12f6bebeb -->
