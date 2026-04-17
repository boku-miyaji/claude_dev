#!/bin/bash
# Hook: PostToolUse (Agent) — Sub-agent起動/完了の自動ログ
# async: true
# Agent toolが使われた後に発火。部署名・説明・モデルを記録。
# ローカル jsonl + Supabase activity_log + agent_sessions の三重書き。

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')

# Agent tool only
[ "$TOOL_NAME" != "Agent" ] && exit 0

AGENT_TYPE=$(echo "$INPUT" | jq -r '.tool_input.subagent_type // empty')
DESCRIPTION=$(echo "$INPUT" | jq -r '.tool_input.description // empty')
MODEL=$(echo "$INPUT" | jq -r '.tool_input.model // "default"')
BACKGROUND=$(echo "$INPUT" | jq -r '.tool_input.run_in_background // false')
TS=$(date -Iseconds)

# Session ID: use CLAUDE_SESSION_ID if available, else date-based
SESSION_ID="${CLAUDE_SESSION_ID:-$(date +%Y%m%d)}"

# --- 1. ローカル jsonl ---
LOG_DIR="$HOME/.claude/logs"
mkdir -p "$LOG_DIR" 2>/dev/null || true
echo "{\"ts\":\"$TS\",\"event\":\"agent_dispatch\",\"dept\":\"$AGENT_TYPE\",\"desc\":\"$DESCRIPTION\",\"model\":\"$MODEL\",\"background\":$BACKGROUND}" >> "$LOG_DIR/agent-activity.jsonl" 2>/dev/null || true

# --- 2. Supabase (x-ingest-key for RLS) ---
ENV_FILE="$HOME/.claude/hooks/supabase.env"
[ -f "$ENV_FILE" ] && source "$ENV_FILE" || exit 0
[ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ] || [ -z "$SUPABASE_INGEST_KEY" ] && exit 0

HEADERS=(-H "apikey: ${SUPABASE_ANON_KEY}" -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" -H "x-ingest-key: ${SUPABASE_INGEST_KEY}" -H "Content-Type: application/json")

# 2a. activity_log (backward compat)
PAYLOAD_AL=$(jq -n \
  --arg desc "$DESCRIPTION" \
  --arg dept "$AGENT_TYPE" \
  --arg model "$MODEL" \
  --argjson bg "$BACKGROUND" \
  '{action:"dept_dispatch", description:($desc|.[:200]), metadata:{dept:$dept, model:$model, background:$bg}}')

curl -s -X POST "${SUPABASE_URL}/rest/v1/activity_log" "${HEADERS[@]}" -d "$PAYLOAD_AL" >/dev/null 2>&1 || true

# 2b. agent_sessions (Managed Agents pattern: append-only session log)
PAYLOAD_AS=$(jq -n \
  --arg sid "$SESSION_ID" \
  --arg dept "$AGENT_TYPE" \
  --arg desc "$DESCRIPTION" \
  --arg model "$MODEL" \
  --argjson bg "$BACKGROUND" \
  '{session_id:$sid, event_type:"dept_dispatch", dept:$dept, payload:{description:($desc|.[:200]), model:$model, background:$bg}}')

curl -s -X POST "${SUPABASE_URL}/rest/v1/agent_sessions" "${HEADERS[@]}" -d "$PAYLOAD_AS" >/dev/null 2>&1 || true

exit 0
