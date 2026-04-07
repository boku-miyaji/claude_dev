#!/bin/bash
# Hook: PostToolUse (Agent) — Sub-agent起動/完了の自動ログ
# async: true
# Agent toolが使われた後に発火。部署名・説明・モデルを記録。

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')

# Agent tool only
[ "$TOOL_NAME" != "Agent" ] && exit 0

AGENT_TYPE=$(echo "$INPUT" | jq -r '.tool_input.subagent_type // empty')
DESCRIPTION=$(echo "$INPUT" | jq -r '.tool_input.description // empty')
MODEL=$(echo "$INPUT" | jq -r '.tool_input.model // "default"')
BACKGROUND=$(echo "$INPUT" | jq -r '.tool_input.run_in_background // false')

LOG_DIR="$HOME/.claude/logs"
mkdir -p "$LOG_DIR" 2>/dev/null || true

echo "{\"ts\":\"$(date -Iseconds)\",\"event\":\"agent_dispatch\",\"dept\":\"$AGENT_TYPE\",\"desc\":\"$DESCRIPTION\",\"model\":\"$MODEL\",\"background\":$BACKGROUND}" >> "$LOG_DIR/agent-activity.jsonl" 2>/dev/null || true

exit 0
