# focus-you: 日記からの自動チェックが反映されない

- **type**: `failure`
- **date**: 2026-04-28
- **category**: quality / **severity**: high
- **status**: resolved
- **source**: detector
- **tags**: focus-you, habits, ui, auto-detected, daily-batch, llm-classified

## what_happened
focus-youの日記に書いた習慣（観葉植物の水やり/葉水）が自動でハビット達成チェックされたはずなのに、UI上でチェックが入っておらず、手動でもチェックできなくなっている状態を発見。

## countermeasure
company-dashboard/src/lib/date.ts に toJstDateStr ヘルパーを追加し、Today.tsx (2箇所), Habits.tsx (11箇所), useWeeklyNarrative.ts (1箇所) の completed_at.substring(0,10) を全て JST 比較に統一。commit 692124bf, c8bd828f。

<!-- id: fd774bc4-0912-429a-b1bd-bc405978c5f7 -->
