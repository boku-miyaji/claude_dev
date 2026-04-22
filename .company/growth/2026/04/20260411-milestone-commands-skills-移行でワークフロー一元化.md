# commands → skills 移行でワークフロー一元化

- **type**: `milestone`
- **date**: 2026-04-11
- **category**: organization / **severity**: medium
- **status**: active
- **source**: backfill
- **tags**: skills, refactor, workflow, claude-dev
- **commits**: 4db27b1, 4bf80f4

## what_happened
21ファイルで+560/-5201 の大規模整理。旧 .claude/commands/ を廃止し skills/ に統合。知識をスキル内に閉じ込める設計原則を徹底した。

## root_cause
commands と skills の二重管理で知識が分散していた

## countermeasure
commands を skills に移行し不要なものを削除

## result
スキル管理のソース・オブ・トゥルースが統一

<!-- id: 56a7b9b5-df3d-4cd7-957e-589b13a707a5 -->
