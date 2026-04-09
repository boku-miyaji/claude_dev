#!/bin/bash
# Hook: PostToolUse (Agent) — Sub-agent起動/完了の自動ログ
# async: true
# Agent toolが使われた後に発火。部署名・説明・モデルを記録。
# ローカル jsonl + Supabase activity_log の二重書き。

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')

# Agent tool only
[ "$TOOL_NAME" != "Agent" ] && exit 0

AGENT_TYPE=$(echo "$INPUT" | jq -r '.tool_input.subagent_type // empty')
DESCRIPTION=$(echo "$INPUT" | jq -r '.tool_input.description // empty')
MODEL=$(echo "$INPUT" | jq -r '.tool_input.model // "default"')
BACKGROUND=$(echo "$INPUT" | jq -r '.tool_input.run_in_background // false')
TS=$(date -Iseconds)

# --- 1. ローカル jsonl ---
LOG_DIR="$HOME/.claude/logs"
mkdir -p "$LOG_DIR" 2>/dev/null || true
echo "{\"ts\":\"$TS\",\"event\":\"agent_dispatch\",\"dept\":\"$AGENT_TYPE\",\"desc\":\"$DESCRIPTION\",\"model\":\"$MODEL\",\"background\":$BACKGROUND}" >> "$LOG_DIR/agent-activity.jsonl" 2>/dev/null || true

# --- 2. Supabase activity_log (x-ingest-key for RLS) ---
ENV_FILE="$HOME/.claude/hooks/supabase.env"
[ -f "$ENV_FILE" ] && source "$ENV_FILE" || exit 0

[ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ] || [ -z "$SUPABASE_INGEST_KEY" ] && exit 0

# Build JSON payload safely with jq
PAYLOAD=$(jq -n \
  --arg desc "$DESCRIPTION" \
  --arg dept "$AGENT_TYPE" \
  --arg model "$MODEL" \
  --argjson bg "$BACKGROUND" \
  '{action:"dept_dispatch", description:($desc|.[:200]), metadata:{dept:$dept, model:$model, background:$bg}}')

curl -s -X POST "${SUPABASE_URL}/rest/v1/activity_log" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "x-ingest-key: ${SUPABASE_INGEST_KEY}" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  >/dev/null 2>&1 || true

exit 0
