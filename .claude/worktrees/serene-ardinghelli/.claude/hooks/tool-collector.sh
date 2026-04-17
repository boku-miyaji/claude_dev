#!/bin/bash
# Hook: PostToolUse → local file accumulator
# Appends tool_name to /tmp/claude-tools-used.txt
# For Skill tool calls, records "Skill:{skill_name}" to track slash command usage
# Flushed by prompt-log.sh on next UserPromptSubmit

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
[ -z "$TOOL_NAME" ] && exit 0

# For Skill tool, append the skill name (e.g., "Skill:company", "Skill:commit")
if [ "$TOOL_NAME" = "Skill" ]; then
  SKILL_NAME=$(echo "$INPUT" | jq -r '.tool_input.skill // empty')
  if [ -n "$SKILL_NAME" ]; then
    TOOL_NAME="Skill:${SKILL_NAME}"
  fi
fi

# For Agent tool, append the subagent type (e.g., "Agent:dept-ai-dev")
if [ "$TOOL_NAME" = "Agent" ]; then
  AGENT_TYPE=$(echo "$INPUT" | jq -r '.tool_input.subagent_type // empty')
  if [ -n "$AGENT_TYPE" ]; then
    TOOL_NAME="Agent:${AGENT_TYPE}"
  fi
fi

echo "$TOOL_NAME" >> /tmp/claude-tools-used.txt

# Hook 実行ログ（可観測性）
LOG_DIR="$HOME/.claude/logs"
mkdir -p "$LOG_DIR" 2>/dev/null || true
echo "{\"ts\":\"$(date -Iseconds)\",\"hook\":\"tool-collector\",\"tool\":\"$TOOL_NAME\",\"status\":\"ok\"}" >> "$LOG_DIR/hook-executions.jsonl" 2>/dev/null || true

exit 0
