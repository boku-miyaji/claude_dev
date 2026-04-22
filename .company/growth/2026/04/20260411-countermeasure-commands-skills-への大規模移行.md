# commands → skills への大規模移行

- **type**: `countermeasure`
- **date**: 2026-04-11
- **category**: tooling / **severity**: medium
- **status**: active
- **source**: daily-digest
- **tags**: skills, refactor, harness
- **commits**: 4db27b1, 4bf80f4

## what_happened
18個の .claude/commands/ を廃止し skills/ 体系へ統一移行。5201行削除・560行追加の大規模整理で、/supabase-preflight など新規スキルも追加。

## root_cause
commandsとskillsの二重管理で運用ルールが散逸し、スキル管理ルールのソース・オブ・トゥルースが曖昧だった。

## countermeasure
commands を全廃し skills に一本化、marketplace 経由で同期する体制に統一。

## result
スキル管理が単一ソースに集約され、運用コストが減少。

<!-- id: d6ddeb75-1e10-429e-a44e-21d4e3d36c56 -->
