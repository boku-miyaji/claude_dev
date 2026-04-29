# focus-you 観葉植物水やり habit のチェック不能

- **type**: `failure`
- **date**: 2026-04-28
- **category**: quality / **severity**: high
- **status**: resolved
- **source**: detector
- **tags**: focus-you, habit, ui, auto-detected, daily-batch, llm-classified
- **parent_id**: `fd774bc4-0912-429a-b1bd-bc405978c5f7`

## what_happened
focus-you の日記から自動チェックされたはずの「観葉植物の水やり（葉水）」habit が、実際にはチェックされておらず、UI 上から手動でチェックも付けられない状態になっている報告。

## countermeasure
#fd774bc4 と同一事象（completed_at の UTC/JST 比較ミス）。toJstDateStr ヘルパーで一括解消。commit 692124bf, c8bd828f。

<!-- id: 9422557f-ca28-4071-9f0f-5235fd73cdd6 -->
