# focus-you を design-spec 準拠に全面改修

- **type**: `milestone`
- **date**: 2026-04-26
- **category**: architecture / **severity**: high
- **status**: active
- **source**: daily-digest
- **tags**: focus-you, ui, frontend, auto-detected, daily-digest
- **commits**: 0ac9793, 2ca9d84, 3379e75, 71e6733, c7f81bd

## what_happened
focus-you ダッシュボードを design-spec 準拠に Phase 1〜4 で全面改修。Today/Journal/Habits/Calendar/Dreams/Story/Roots/Manual/Frameworks 各ページの CSS とコンポーネントを spec の class 体系（.ls / .h-item / .t-item / .e-item / .page-heading 等）に統一し、PageHeader・Sidebar・TimelineSection・Briefing・FutureYou などを刷新した。

## root_cause
従来の UI が design-spec から乖離しており、ページごとに class やレイアウトがバラバラだった

## countermeasure
spec を真として CSS とコンポーネントを段階的に置換、Today を 1カラム→2カラム化（Writing + Life）

## result
全ページが spec 準拠のレイアウトと表現に統一

<!-- id: 83451c21-bd5e-41aa-8739-47c2f7f05ef1 -->
