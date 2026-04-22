# CLAUDE.md 208→64行プルーニング — 知識の適切な分離

- **type**: `countermeasure`
- **date**: 2026-04-05
- **category**: architecture / **severity**: critical
- **status**: resolved
- **source**: manual
- **tags**: architecture, claude-md, pruning, context-optimization, IMP-001, claude-dev
- **commits**: fc34479

## what_happened
14件の改善提案のうちIMP-001として最優先実施。CLAUDE.mdが208行に肥大化しコンテキストウィンドウを圧迫。方針のみ残し、手順詳細はreferences/、ルールはrules/に分離。69%削減に成功。

## root_cause
新機能追加のたびにCLAUDE.mdに手順を直接書き足していた。「方針」と「手順」の区別がなかった。

## countermeasure
設計原則を明文化: CLAUDE.md=方針のみ（What/Why）、references/=手順（How）、rules/=制約。サイズチェックHook（80行警告）も導入。

## result
コンテキスト効率が劇的に改善。「知識をどこに置くか」のアーキテクチャが確立。以後のCLAUDE.md肥大化を構造的に防止。

<!-- id: 306d1e51-63b7-4ba6-8feb-d204c4dbfed3 -->
