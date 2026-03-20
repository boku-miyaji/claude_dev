#!/bin/bash
# Hook: SessionStart → Supabase claude_settings
# Syncs settings.json, .mcp.json, CLAUDE.md, skills, plugins on every session start.
# This replaces the manual sync that previously only ran on /company.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/supabase.env"

# Read hook input from stdin
INPUT=$(cat)

CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$CWD}"

if [ -z "$PROJECT_DIR" ]; then
  exit 0
fi

SCOPE=$(basename "$PROJECT_DIR")
SETTINGS_FILE="$PROJECT_DIR/.claude/settings.json"
MCP_FILE="$PROJECT_DIR/.claude/.mcp.json"
CLAUDE_MD_FILE="$PROJECT_DIR/.claude/CLAUDE.md"

# Read settings.json
SETTINGS_JSON="{}"
if [ -f "$SETTINGS_FILE" ]; then
  SETTINGS_JSON=$(cat "$SETTINGS_FILE")
fi

# Extract plugins and permissions
PLUGINS=$(echo "$SETTINGS_JSON" | jq '.enabledPlugins // {}')
PERMISSIONS=$(echo "$SETTINGS_JSON" | jq '.permissions // {}')

# Read MCP servers config
MCP_SERVERS="{}"
if [ -f "$MCP_FILE" ]; then
  MCP_SERVERS=$(jq '.mcpServers // {}' "$MCP_FILE")
fi

# Read CLAUDE.md content
CLAUDE_MD_CONTENT=""
if [ -f "$CLAUDE_MD_FILE" ]; then
  CLAUDE_MD_CONTENT=$(cat "$CLAUDE_MD_FILE")
fi

# Build skills list from settings (enabled plugins = available skills)
SKILLS="$PLUGINS"

# Build upsert payload
PAYLOAD=$(jq -n \
  --arg id "$SCOPE" \
  --arg scope "$SCOPE" \
  --arg server_path "$PROJECT_DIR" \
  --argjson settings_json "$SETTINGS_JSON" \
  --argjson plugins "$PLUGINS" \
  --argjson permissions "$PERMISSIONS" \
  --argjson skills "$SKILLS" \
  --argjson mcp_servers "$MCP_SERVERS" \
  --arg claude_md_content "$CLAUDE_MD_CONTENT" \
  '{
    id: $id,
    scope: $scope,
    server_path: $server_path,
    settings_json: $settings_json,
    plugins: $plugins,
    permissions: $permissions,
    skills: $skills,
    mcp_servers: $mcp_servers,
    claude_md_content: $claude_md_content
  }')

# Upsert to Supabase claude_settings
curl -s -o /dev/null -w "" \
  "${SUPABASE_URL}/rest/v1/claude_settings?on_conflict=id" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal,resolution=merge-duplicates" \
  -d "$PAYLOAD" \
  --max-time 10 \
  2>/dev/null || true

# Log sync activity
ACTIVITY=$(jq -n \
  --arg action "hook_sync" \
  --arg description "SessionStart hook: config synced to dashboard" \
  --argjson metadata "$(jq -n --arg scope "$SCOPE" --arg source "hook" '{scope: $scope, source: $source}')" \
  '{action: $action, description: $description, metadata: $metadata}')

curl -s -o /dev/null -w "" \
  "${SUPABASE_URL}/rest/v1/activity_log" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d "$ACTIVITY" \
  --max-time 5 \
  2>/dev/null || true

exit 0
