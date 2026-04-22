# 部署駆動体制の整備 — pipeline/handoff/ops/marketing

- **type**: `countermeasure`
- **date**: 2026-04-03
- **category**: organization / **severity**: medium
- **status**: active
- **source**: backfill
- **tags**: pipeline, handoff, departments, skills
- **commits**: 2f1fe10, cb19f79, eb08814, 022d78f, 05b6ae8, 041bbcf

## what_happened
止まっていた部署にトリガー・入出力・ハンドオフを定義し、pipeline と handoff を .claude/rules/ に昇格、並列実行対応に改善。ops 部署・マーケティング部を新設し、スキル管理を sync-skills.sh で自動化。

## root_cause
部署運用の暗黙知がCLAUDE.md/memoryに分散し、部署が自律的に回らなかったため。

## countermeasure
ルールを rules/ に昇格、pipeline 並列化、部署新設、スキル同期スクリプト導入。

## result
部署サイクルが明文化され、HowItWorksにも「なぜ回っているか」を追記した。

<!-- id: 9de01e98-4c4c-42e5-adda-fbc02e54c7e2 -->
