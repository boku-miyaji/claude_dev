#!/bin/bash
# Hook: PostToolUse → local file accumulator
# Appends tool_name to /tmp/claude-tools-used.jsonl
# Flushed by prompt-log.sh on next UserPromptSubmit

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
[ -z "$TOOL_NAME" ] && exit 0

echo "$TOOL_NAME" >> /tmp/claude-tools-used.txt
exit 0
