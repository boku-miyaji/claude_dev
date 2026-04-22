# ダッシュボード全面React化完了

- **type**: `milestone`
- **date**: 2026-04-12
- **category**: architecture / **severity**: high
- **status**: active
- **source**: daily-digest
- **tags**: react, refactor, dashboard, legacy-removal, claude-dev
- **commits**: 12d99cf, 0f96274, 637761d, 3f34489, 3d36b97, 2cbb6ba, 779f5a1, 69b87c2

## what_happened
Insights/Settings/Growth/Calendar/Career/ApiCosts/Prompts/Artifacts/Finance/Chat などlegacy HTMLで残っていた主要ページを一気にReact化。Sidebarもプロダクト/CLI で分離し、legacy.ts を削除。

## root_cause
legacy HTMLとReactの二重管理で共通ロジック分散・バグ温床化していた

## countermeasure
CLI専用ページを一括React移植し、不要ルートをリダイレクト化

## result
UI基盤が単一化、以降の機能追加がReact前提で進められるようになった

<!-- id: 3567fbf4-5a93-4242-8115-8679d3455d17 -->
