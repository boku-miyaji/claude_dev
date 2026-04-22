# AIチャットhistory常に0件 — tool_call_idカラム不在

- **type**: `failure`
- **date**: 2026-04-05
- **category**: architecture / **severity**: critical
- **status**: resolved
- **source**: manual
- **tags**: ai-chat, migration, focus-you

## what_happened
SELECT tool_call_id FROM messagesがエラー。全会話でhistory_count=0

## root_cause
migration-025にtool_call_idカラムなし。silent fail

## countermeasure
migration-047追加+debug SSE追加

## result
会話文脈が正常に維持

<!-- id: 708021b6-7a5b-4a80-b4bd-f38f0e654193 -->
