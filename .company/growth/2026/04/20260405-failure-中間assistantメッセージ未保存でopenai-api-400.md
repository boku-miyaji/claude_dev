# 中間assistantメッセージ未保存でOpenAI API 400

- **type**: `failure`
- **date**: 2026-04-05
- **category**: architecture / **severity**: high
- **status**: resolved
- **source**: manual
- **tags**: ai-chat, tool-calls

## what_happened
tool_calls含むassistantがDB未保存→orphaned tool messages→API reject

## root_cause
in-memory pushのみでDB INSERT漏れ

## countermeasure
中間assistant保存+scan-ahead検証+欠損時ブロックスキップ

## result
ツール使用後もhistory正常復元

<!-- id: 3df33eaf-2682-4559-b307-a1cd8b87ed6c -->
