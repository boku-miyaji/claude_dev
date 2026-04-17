#!/bin/bash
# Hook: PostToolUse (matcher: Skill) → Supabase activity_log
# スキル（Skill tool）の使用を activity_log に記録する。
# 非同期で実行され、会話をブロックしない。

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/supabase-check.sh"
[ "$SUPABASE_AVAILABLE" = "true" ] || exit 0

INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
[ "$TOOL_NAME" = "Skill" ] || exit 0

SKILL_NAME=$(echo "$INPUT" | jq -r '.tool_input.skill // empty')
[ -n "$SKILL_NAME" ] || exit 0

TOOL_INPUT=$(echo "$INPUT" | jq -c '.tool_input // {}')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
CONTEXT=$(basename "$CWD" 2>/dev/null || echo "unknown")

METADATA=$(jq -n \
  --arg skill_name "$SKILL_NAME" \
  --argjson tool_input "$TOOL_INPUT" \
  --arg cwd "$CWD" \
  --arg context "$CONTEXT" \
  '{skill_name: $skill_name, tool_input: $tool_input, cwd: $cwd, context: $context}')

PAYLOAD=$(jq -n \
  --arg action "skill_usage" \
  --arg description "Skill invoked: ${SKILL_NAME}" \
  --argjson metadata "$METADATA" \
  '{action: $action, description: $description, metadata: $metadata}')

curl -4 -s -o /dev/null -w "" \
  "${SUPABASE_URL}/rest/v1/activity_log" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d "$PAYLOAD" \
  --connect-timeout 10 \
  --max-time 15 \
  2>/dev/null || true

LOG_DIR="$HOME/.claude/logs"
mkdir -p "$LOG_DIR" 2>/dev/null || true
echo "{\"ts\":\"$(date -Iseconds)\",\"hook\":\"skill-usage-log\",\"skill\":\"$SKILL_NAME\",\"status\":\"ok\"}" >> "$LOG_DIR/hook-executions.jsonl" 2>/dev/null || true

exit 0
