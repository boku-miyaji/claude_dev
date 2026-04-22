# 動的パイプライン計画への移行

- **type**: `milestone`
- **date**: 2026-04-08
- **category**: architecture / **severity**: high
- **status**: active
- **source**: backfill
- **tags**: pipeline, orchestration, process, agent-harness
- **commits**: 388d5ea, dbf07a2

## what_happened
キーワードベースのルーティングをやめ、オーケストレーターが指示を受けて動的に部署計画を立てる方式に刷新。pipeline.md を /company 非依存で常時有効にし、役割分担を明確化した。

## root_cause
社長から「動的にもっと動けないのか、計画に部署が入っていない」との指摘

## countermeasure
dynamic pipeline planning に置き換え、pipeline rules をリファクタ

## result
タスク規模に応じた柔軟な部署委譲が可能に

<!-- id: 0e17afef-bd49-4983-903c-bfd60a7d7dba -->
