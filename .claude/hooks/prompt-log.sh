#!/bin/bash
# Hook: UserPromptSubmit → Supabase prompt_log
# Logs every user prompt to the company dashboard.
# Runs async so it never blocks the conversation.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/supabase-check.sh"
[ "$SUPABASE_AVAILABLE" = "true" ] || exit 0

# Read hook input from stdin
INPUT=$(cat)

PROMPT=$(echo "$INPUT" | jq -r '.prompt // empty')

# Skip empty or trivial confirmation prompts
if [ -z "$PROMPT" ]; then
  exit 0
fi

# Skip single-word confirmations (はい, OK, yes, etc.)
TRIMMED=$(echo "$PROMPT" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
case "$TRIMMED" in
  "はい"|"ok"|"OK"|"Ok"|"yes"|"Yes"|"YES"|"うん"|"了解"|"y"|"Y"|"n"|"N"|"いいえ"|"no"|"No")
    exit 0
    ;;
esac

# Extract context from CWD
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
CONTEXT=$(basename "$CWD" 2>/dev/null || echo "unknown")

# --- Session ID detection ---
# Find the most recent session file and extract sessionId
SESSION_ID=""
CLAUDE_CONFIG="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
SESSIONS_DIR="$CLAUDE_CONFIG/sessions"
if [ -d "$SESSIONS_DIR" ]; then
  LATEST_SESSION_FILE=$(ls -t "$SESSIONS_DIR"/*.json 2>/dev/null | head -1)
  if [ -n "$LATEST_SESSION_FILE" ]; then
    SESSION_ID=$(jq -r '.sessionId // empty' "$LATEST_SESSION_FILE" 2>/dev/null)
  fi
fi

# Server identification
SERVER_HOST=$(hostname -s 2>/dev/null || echo "unknown")

# Infer company_id from CWD (e.g. /workspace/.company-rikyu/ → rikyu)
COMPANY_ID=""
if echo "$CWD" | grep -qP '\.company-[a-z]'; then
  COMPANY_ID=$(echo "$CWD" | grep -oP '\.company-\K[a-z0-9-]+' | head -1)
fi
# Also infer from prompt content mentioning /company {name}
if [ -z "$COMPANY_ID" ]; then
  COMPANY_ID=$(echo "$PROMPT" | grep -oP '/company\s+\K[a-z0-9-]+' | head -1 || true)
fi
# Infer from prompt keywords if still empty
# GENERATED:COMPANY_PATTERNS:START
if [ -z "$COMPANY_ID" ]; then
  echo "$PROMPT" | grep -qi "rikyu\|りきゅう\|りそな\|proposal\|アンケート\|営業支援\|設問\|集計" && COMPANY_ID="rikyu"
fi
if [ -z "$COMPANY_ID" ]; then
  echo "$PROMPT" | grep -qi "回路\|circuit\|図面\|暗黙知\|tacit" && COMPANY_ID="circuit"
fi
if [ -z "$COMPANY_ID" ]; then
  echo "$PROMPT" | grep -qi "polaris\|ポラリス\|坂本\|協業\|図面暗黙知" && COMPANY_ID="polaris"
fi
if [ -z "$COMPANY_ID" ]; then
  echo "$PROMPT" | grep -qi "sompo\|foundry\|scotch\|SOMPOケア\|Lakehouse" && COMPANY_ID="foundry"
fi
# GENERATED:COMPANY_PATTERNS:END

# Auto-tag using LLM (gpt-5-nano via Edge Function completion mode)
# Falls back to empty tags if LLM call fails (never blocks)
TAGS="[]"
TAG_LIST=()

# --- Skill detection (deterministic, no LLM needed) ---
DETECTED_SKILL=$(echo "$PROMPT" | grep -oP '^/' | head -1 || true)
if [ -n "$DETECTED_SKILL" ]; then
  SKILL_CMD=$(echo "$PROMPT" | grep -oP '^/[a-zA-Z0-9_:-]+' | head -1 || true)
  if [ -n "$SKILL_CMD" ]; then
    TAG_LIST+=("skill:${SKILL_CMD}")
  fi
fi

# --- LLM-based classification (gpt-5-nano, ~0.01円/call) ---
LLM_TAGS=""
PROMPT_SHORT=$(echo "$PROMPT" | head -c 500)
CLASSIFY_PAYLOAD=$(jq -n \
  --arg msg "$PROMPT_SHORT" \
  '{
    mode: "completion",
    model: "gpt-5-nano",
    max_tokens: 100,
    system_prompt: "You are a prompt classifier. Given a user message, output a JSON object with these fields:\n- pj: project name if mentioned (rikyu/circuit/foundry/instagram or null)\n- intent: one of implement/fix/investigate/design/review/brainstorm/manage/info/chat\n- dept: most relevant department (ai-dev/sys-dev/security/materials/intelligence/research/ux-design/pm/ops/secretary or null)\n- cat: category (feature/infra/docs/quality/ops or null)\nRespond with ONLY the JSON object, no explanation.",
    message: $msg,
    response_format: {"type": "json_object"}
  }')

LLM_RESPONSE=$(curl -4 -s \
  "${SUPABASE_URL}/functions/v1/ai-agent" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "$CLASSIFY_PAYLOAD" \
  --connect-timeout 5 \
  --max-time 10 \
  2>/dev/null) || LLM_RESPONSE=""

if [ -n "$LLM_RESPONSE" ]; then
  # Extract content from completion response
  LLM_CONTENT=$(echo "$LLM_RESPONSE" | jq -r '.content // empty' 2>/dev/null)
  if [ -n "$LLM_CONTENT" ]; then
    # Parse JSON tags
    PJ=$(echo "$LLM_CONTENT" | jq -r '.pj // empty' 2>/dev/null)
    INTENT=$(echo "$LLM_CONTENT" | jq -r '.intent // empty' 2>/dev/null)
    DEPT=$(echo "$LLM_CONTENT" | jq -r '.dept // empty' 2>/dev/null)
    CAT=$(echo "$LLM_CONTENT" | jq -r '.cat // empty' 2>/dev/null)

    [ -n "$PJ" ] && [ "$PJ" != "null" ] && TAG_LIST+=("pj:${PJ}")
    [ -n "$INTENT" ] && [ "$INTENT" != "null" ] && TAG_LIST+=("intent:${INTENT}")
    [ -n "$DEPT" ] && [ "$DEPT" != "null" ] && TAG_LIST+=("dept:${DEPT}")
    [ -n "$CAT" ] && [ "$CAT" != "null" ] && TAG_LIST+=("cat:${CAT}")

    # Also update company_id from LLM if not already set
    if [ -z "$COMPANY_ID" ] && [ -n "$PJ" ] && [ "$PJ" != "null" ]; then
      COMPANY_ID="$PJ"
    fi
  fi
fi

if [ ${#TAG_LIST[@]} -gt 0 ]; then
  TAGS=$(printf '%s\n' "${TAG_LIST[@]}" | jq -R . | jq -s .)
fi

# Flush tool usage from previous prompt (collected by tool-collector.sh)
TOOLS_FILE="/tmp/claude-tools-used.txt"
TOOLS_USED="{}"
TOOL_COUNT=0
if [ -f "$TOOLS_FILE" ] && [ -s "$TOOLS_FILE" ]; then
  # Count occurrences of each tool: {"Read": 5, "Edit": 2, ...}
  TOOLS_USED=$(sort "$TOOLS_FILE" | uniq -c | awk '{print $2, $1}' | jq -Rn '[inputs | split(" ") | {(.[0]): (.[1] | tonumber)}] | add // {}')
  TOOL_COUNT=$(wc -l < "$TOOLS_FILE" | tr -d ' ')
  rm -f "$TOOLS_FILE"
fi

# Build JSON payload (with server_host, cwd, company_id, session_id, tools_used)
PAYLOAD=$(jq -n \
  --arg prompt "$PROMPT" \
  --arg context "$CONTEXT" \
  --argjson tags "$TAGS" \
  --arg server_host "$SERVER_HOST" \
  --arg cwd "$CWD" \
  --arg company_id "$COMPANY_ID" \
  --arg session_id "$SESSION_ID" \
  --argjson tools_used "$TOOLS_USED" \
  --argjson tool_count "$TOOL_COUNT" \
  '{prompt: $prompt, context: $context, tags: $tags, server_host: $server_host, cwd: $cwd}
   | if $company_id != "" then . + {company_id: $company_id} else . end
   | if $session_id != "" then . + {session_id: $session_id} else . end
   | if $tool_count > 0 then . + {tools_used: $tools_used, tool_count: $tool_count} else . end')

# Upsert prompt_sessions (if session_id available)
if [ -n "$SESSION_ID" ]; then
  SESSION_PAYLOAD=$(jq -n \
    --arg id "$SESSION_ID" \
    --arg company_id "$COMPANY_ID" \
    --argjson tags "$TAGS" \
    --arg server_host "$SERVER_HOST" \
    --arg cwd "$CWD" \
    '{id: $id, ended_at: (now | todate), tags: $tags, server_host: $server_host, cwd: $cwd, prompt_count: 1}
     | if $company_id != "" then . + {company_id: $company_id} else . end')

  curl -4 -s -o /dev/null -w "" \
    "${SUPABASE_URL}/rest/v1/prompt_sessions" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal,resolution=merge-duplicates" \
    -H "x-ingest-key: ${SUPABASE_INGEST_KEY}" \
    -d "$SESSION_PAYLOAD" \
    --connect-timeout 10 \
    --max-time 15 \
    2>/dev/null || true
fi

# POST to Supabase prompt_log
curl -4 -s -o /dev/null -w "" \
  "${SUPABASE_URL}/rest/v1/prompt_log" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -H "x-ingest-key: ${SUPABASE_INGEST_KEY}" \
  -d "$PAYLOAD" \
  --connect-timeout 10 \
  --max-time 15 \
  2>/dev/null || true

exit 0
