# Blueprint更新確認をfocus-you限定とCLAUDE.md明記

- **type**: `countermeasure`
- **date**: 2026-04-25
- **category**: process / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: claude-dev, focus-you, auto-detected, daily-batch, llm-classified

## what_happened
focus-youの設計対応をBlueprint.tsxの更新と混同していた指摘を受け、Blueprint更新確認はfocus-you/company-dashboard PJ限定であることをCLAUDE.mdに明記。他PJには適用しない

## root_cause
Blueprint.tsxのスコープが曖昧で、他PJ作業時にも更新確認が走っていた

## countermeasure
CLAUDE.mdの「Blueprint更新確認」項目にfocus-you/company-dashboard PJ限定の文言と他PJ非適用を追加

<!-- id: bf010dc4-d60b-4ab7-b1d4-8b3f7efddaf7 -->
