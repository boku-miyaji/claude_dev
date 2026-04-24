# tasks/requests混同の再発防止

- **type**: `countermeasure`
- **date**: 2026-04-24
- **category**: process / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: focus-you, tasks, requests, auto-detected, daily-batch, llm-classified

## what_happened
requestsの内容確認・修正時に個人タスク(type='task')まで対象に含めてしまい、社長から「個人タスクとrequestsは分けて、tasks/requestsとわざわざ分けているのに意味がない」と再度指摘された。「これからも同じミスしない？ちゃんと運用に乗るようにして」と対策定着を求められた。

## root_cause
tasks テーブルと requests(type='request')の分離が暗黙知になっており、毎回確認しないと取り違える

## countermeasure
requests文脈では type='request' のみを対象にするルールを Auto Memory に固定。/company 起動時に必ずこの境界を確認する運用を徹底する

<!-- id: 6123ca8b-a7f9-47a1-874f-8c16c5157c42 -->
