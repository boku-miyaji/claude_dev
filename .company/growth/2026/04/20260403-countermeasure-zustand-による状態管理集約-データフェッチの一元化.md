# Zustand による状態管理集約 — データフェッチの一元化

- **type**: `countermeasure`
- **date**: 2026-04-03
- **category**: architecture / **severity**: medium
- **status**: resolved
- **source**: manual
- **tags**: architecture, zustand, state-management, data-fetching
- **commits**: 660f103

## what_happened
React移行後、各ページが個別にSupabaseからデータ取得していた。同じデータを複数ページで重複取得し、キャッシュもページごとにバラバラ。

## root_cause
グローバルな状態管理がなく、各ページが独立してデータを管理していた。

## countermeasure
useDataStore (Zustand) に全データフェッチ・キャッシュ・ミューテーションを集約。5分間のキャッシュ + 楽観的更新でUXを改善。

## result
データの重複取得が解消され、ページ間のデータ整合性が保証された。新ページ追加時のデータ取得パターンも統一。

<!-- id: ef6322a4-69d5-4505-a084-2eebfb365843 -->
