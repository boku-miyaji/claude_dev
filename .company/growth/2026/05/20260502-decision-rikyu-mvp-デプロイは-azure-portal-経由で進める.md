# rikyu MVP デプロイは Azure Portal 経由で進める

- **type**: `decision`
- **date**: 2026-05-02
- **category**: devops / **severity**: medium
- **status**: active
- **source**: daily-digest
- **tags**: rikyu, devops, ci-cd, operations, auto-detected, daily-digest

## what_happened
rikyu MVP のデプロイ作業について、CI/CDによる自動化ではなく Azure Portal の GUI 操作で進める方針を決定。SP なしで build/push のみとする以前の方針と整合し、当面は手動デプロイで MVP を回す。

## root_cause
Azure RBAC ロール割り当て権限不足の失敗があり、SP発行・自動化の優先度を下げた

## countermeasure
Portal 経由の手動デプロイを採用し、CI/CD は build/push までに限定

## result
MVP フェーズの進行を妨げない暫定運用を確立

<!-- id: 77a8b255-a652-4962-83d1-292079e77714 -->
