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

# Server identifier: hostname:project_dir (unique per machine + directory)
SERVER_HOST=$(hostname -s 2>/dev/null || echo "local")
SCOPE="${SERVER_HOST}:${PROJECT_DIR}"
SETTINGS_FILE="$PROJECT_DIR/.claude/settings.json"
MCP_FILE="$PROJECT_DIR/.claude/.mcp.json"
CLAUDE_MD_FILE="$PROJECT_DIR/.claude/CLAUDE.md"

# Read settings.json (shared, committed to git)
SETTINGS_JSON="{}"
if [ -f "$SETTINGS_FILE" ]; then
  SETTINGS_JSON=$(cat "$SETTINGS_FILE")
fi

# Read settings.local.json (machine-specific, gitignored)
LOCAL_SETTINGS_FILE="$PROJECT_DIR/.claude/settings.local.json"
LOCAL_SETTINGS_JSON="{}"
if [ -f "$LOCAL_SETTINGS_FILE" ]; then
  LOCAL_SETTINGS_JSON=$(cat "$LOCAL_SETTINGS_FILE")
fi

# Merge: local overrides shared, permissions.allow arrays are concatenated
MERGED_SETTINGS=$(jq -n \
  --argjson shared "$SETTINGS_JSON" \
  --argjson local "$LOCAL_SETTINGS_JSON" \
  '$shared * $local | .permissions.allow = (($shared.permissions.allow // []) + ($local.permissions.allow // []) | unique) | .permissions.additionalDirectories = (($shared.permissions.additionalDirectories // []) + ($local.permissions.additionalDirectories // []) | unique)')

# Extract plugins and permissions from merged
PLUGINS=$(echo "$MERGED_SETTINGS" | jq '.enabledPlugins // {}')
PERMISSIONS=$(echo "$MERGED_SETTINGS" | jq '.permissions // {}')

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
  --argjson settings_json "$MERGED_SETTINGS" \
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

# If migration-009 is applied (server_host column exists), add it
PAYLOAD_WITH_HOST=$(echo "$PAYLOAD" | jq --arg sh "$SERVER_HOST" '. + {server_host: $sh}')

# Upsert to Supabase claude_settings
# Try with server_host first (migration-009), fallback without
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  "${SUPABASE_URL}/rest/v1/claude_settings?on_conflict=id" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal,resolution=merge-duplicates" \
  -d "$PAYLOAD_WITH_HOST" \
  --max-time 10 \
  2>/dev/null) || true

if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "201" ]; then
  # Fallback: without server_host (pre migration-009)
  curl -s -o /dev/null -w "" \
    "${SUPABASE_URL}/rest/v1/claude_settings?on_conflict=id" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal,resolution=merge-duplicates" \
    -d "$PAYLOAD" \
    --max-time 10 \
    2>/dev/null || true
fi

# Sync plugin cache: copy local SKILL.md files to plugin cache
# This ensures the plugin system uses the latest version on every server
CACHE_BASE="$HOME/.claude/plugins/cache/ai-company/company/1.0.0"
SOURCE_BASE="$PROJECT_DIR/plugins/company"
if [ -d "$SOURCE_BASE/skills" ] && [ -d "$CACHE_BASE" ]; then
  for skill_dir in "$SOURCE_BASE"/skills/*/; do
    [ -d "$skill_dir" ] || continue
    skill_name=$(basename "$skill_dir")
    cache_skill_dir="$CACHE_BASE/skills/$skill_name"
    mkdir -p "$cache_skill_dir"
    # Copy SKILL.md and references/
    if [ -f "$skill_dir/SKILL.md" ]; then
      cp -f "$skill_dir/SKILL.md" "$cache_skill_dir/SKILL.md"
    fi
    if [ -d "$skill_dir/references" ]; then
      cp -rf "$skill_dir/references" "$cache_skill_dir/"
    fi
  done
fi

# Sync slash commands (diff-based)
"$SCRIPT_DIR/sync-slash-commands.sh" "$PROJECT_DIR" 2>/dev/null || true

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
