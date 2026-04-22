# 部署知識ローテーション — CLAUDE.md自動リフレッシュ

- **type**: `milestone`
- **date**: 2026-04-05
- **category**: automation / **severity**: medium
- **status**: resolved
- **source**: manual
- **tags**: automation, department, knowledge-rotation, claude-md, maintenance, claude-dev
- **commits**: cb66f2e

## what_happened
各部署のCLAUDE.mdが時間経過で実態と乖離する問題に対し、部署ごとの知識ローテーション機構を導入。部署の活動実績に基づいてCLAUDE.mdの内容を定期的に見直し・更新する仕組み。

## root_cause
部署CLAUDE.mdは作成時点の設計意図で書かれるが、実際の運用で得られた知見が反映されない。

## countermeasure
活動ログ分析→CLAUDE.md更新提案→承認→適用のサイクルを自動化。

## result
CLAUDE.mdは「生き物」であり、定期的なメンテナンスが必要。自動化により陳腐化を防止。

<!-- id: 9f8cda4c-015c-4c04-bd80-8469e21b2d8b -->
