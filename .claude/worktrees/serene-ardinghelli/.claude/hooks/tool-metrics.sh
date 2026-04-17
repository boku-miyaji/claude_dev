#!/bin/bash
# Hook: PreToolUse + PostToolUse → Supabase execution_metrics
# Tracks tool usage timing for Claude Code sessions.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/supabase-check.sh"
[ "$SUPABASE_AVAILABLE" = "true" ] || exit 0

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
TOOL_INPUT=$(echo "$INPUT" | jq -r '.tool_input // empty' | head -c 200)

METRICS_DIR="/tmp/claude-tool-metrics"
mkdir -p "$METRICS_DIR" 2>/dev/null || true

TOOL_OUTPUT=$(echo "$INPUT" | jq -r '.tool_output // empty' | head -c 100)

if [ -z "$TOOL_OUTPUT" ]; then
  # PreToolUse: record start time
  echo "$(date +%s%3N)" > "$METRICS_DIR/${TOOL_NAME}_start" 2>/dev/null || true
  exit 0
fi

# PostToolUse: calculate duration, log to Supabase
START_FILE="$METRICS_DIR/${TOOL_NAME}_start"
DURATION_MS=0
if [ -f "$START_FILE" ]; then
  START_MS=$(cat "$START_FILE")
  NOW_MS=$(date +%s%3N)
  DURATION_MS=$((NOW_MS - START_MS))
  rm -f "$START_FILE"
fi

PAYLOAD=$(jq -n \
  --arg source "claude_code" \
  --argjson total_time "$DURATION_MS" \
  --argjson tool_count 1 \
  --arg prompt_summary "$TOOL_INPUT" \
  --argjson tools_used "$(jq -nc --arg n "$TOOL_NAME" --argjson d "$DURATION_MS" '[{name:$n,duration_ms:$d}]')" \
  '{source: $source, total_time_ms: $total_time, tool_count: $tool_count, tools_used: $tools_used, prompt_summary: $prompt_summary}')

curl -4 -s -o /dev/null \
  "${SUPABASE_URL}/rest/v1/execution_metrics" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -H "x-ingest-key: ${SUPABASE_INGEST_KEY}" \
  -d "$PAYLOAD" \
  --connect-timeout 5 \
  --max-time 10 \
  2>/dev/null || true

exit 0
