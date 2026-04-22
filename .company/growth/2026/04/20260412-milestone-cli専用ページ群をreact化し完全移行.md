# CLI専用ページ群をReact化し完全移行

- **type**: `milestone`
- **date**: 2026-04-12
- **category**: architecture / **severity**: high
- **status**: active
- **source**: backfill
- **tags**: react, refactor, dashboard, legacy-removal
- **commits**: 779f5a1, 3d36b97, 3f34489, 637761d, 0f96274, 12d99cf, 2cbb6ba, 69b87c2

## what_happened
Insights/Settings/Growth/Calendar/Career/ApiCosts/Prompts/Artifacts/Finance/Chat など legacy HTML ベースのページを一斉に React 化。legacy.ts を削除し、App.tsx のルーティングも整理。React Sidebar をプロダクト/CLI で分離した。

## root_cause
legacy HTML と React が混在し、保守性・UX一貫性が低下していた

## countermeasure
各ページを React コンポーネントへ段階的に移植し、不要ルートはリダイレクト化

## result
ダッシュボードが React ベースに統一され、UI改善の土台が整った

<!-- id: 9b1e010f-3aae-45ea-994f-a77b4ef0336c -->
