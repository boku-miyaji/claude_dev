#!/bin/bash
# Hook: SessionStart → Supabase claude_settings
# Syncs settings.json, .mcp.json, CLAUDE.md, skills, plugins on every session start.
# This replaces the manual sync that previously only ran on /company.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/supabase-check.sh"
[ "$SUPABASE_AVAILABLE" = "true" ] || exit 0

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

# Read .company/CLAUDE.md for HD config sync (migration-010)
COMPANY_CLAUDE_MD=""
COMPANY_CLAUDE_MD_FILE="$PROJECT_DIR/.company/CLAUDE.md"
if [ -f "$COMPANY_CLAUDE_MD_FILE" ]; then
  COMPANY_CLAUDE_MD=$(cat "$COMPANY_CLAUDE_MD_FILE")
fi

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
  --arg company_claude_md "$COMPANY_CLAUDE_MD" \
  '{
    id: $id,
    scope: $scope,
    server_path: $server_path,
    settings_json: $settings_json,
    plugins: $plugins,
    permissions: $permissions,
    skills: $skills,
    mcp_servers: $mcp_servers,
    claude_md_content: $claude_md_content,
    company_claude_md: $company_claude_md
  }')

# If migration-009 is applied (server_host column exists), add it
PAYLOAD_WITH_HOST=$(echo "$PAYLOAD" | jq --arg sh "$SERVER_HOST" '. + {server_host: $sh}')

# Upsert to Supabase claude_settings
# Try with server_host first (migration-009), fallback without
HTTP_CODE=$(curl -4 -s -o /dev/null -w "%{http_code}" \
  "${SUPABASE_URL}/rest/v1/claude_settings?on_conflict=id" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal,resolution=merge-duplicates" \
  -H "x-ingest-key: ${SUPABASE_INGEST_KEY}" \
  -d "$PAYLOAD_WITH_HOST" \
  --connect-timeout 10 \
  --max-time 20 \
  2>/dev/null) || true

if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "201" ]; then
  # Fallback: without server_host (pre migration-009)
  curl -4 -s -o /dev/null -w "" \
    "${SUPABASE_URL}/rest/v1/claude_settings?on_conflict=id" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal,resolution=merge-duplicates" \
    -H "x-ingest-key: ${SUPABASE_INGEST_KEY}" \
    -d "$PAYLOAD" \
    --connect-timeout 10 \
    --max-time 20 \
    2>/dev/null || true
fi

# Sync plugin cache: ensure ai-company plugin is fully installed and up to date
# This creates the cache from scratch if missing, or updates if stale
CACHE_BASE="$HOME/.claude/plugins/cache/ai-company/company/1.0.0"
SOURCE_BASE="$PROJECT_DIR/plugins/company"
if [ -d "$SOURCE_BASE/skills" ]; then
  # Create cache base structure if missing
  mkdir -p "$CACHE_BASE/.claude-plugin"
  mkdir -p "$CACHE_BASE/skills"

  # Sync marketplace.json (required for skills-based plugin format)
  if [ -f "$SOURCE_BASE/.claude-plugin/marketplace.json" ]; then
    cp -f "$SOURCE_BASE/.claude-plugin/marketplace.json" "$CACHE_BASE/.claude-plugin/marketplace.json"
  fi
  # Remove legacy plugin.json if marketplace.json exists
  if [ -f "$CACHE_BASE/.claude-plugin/marketplace.json" ] && [ -f "$CACHE_BASE/.claude-plugin/plugin.json" ]; then
    rm -f "$CACHE_BASE/.claude-plugin/plugin.json"
  fi

  # Ensure README exists
  if [ ! -f "$CACHE_BASE/README.md" ]; then
    echo "# ai-company plugin" > "$CACHE_BASE/README.md"
  fi

  # Sync all skills (SKILL.md + references/)
  for skill_dir in "$SOURCE_BASE"/skills/*/; do
    [ -d "$skill_dir" ] || continue
    skill_name=$(basename "$skill_dir")
    cache_skill_dir="$CACHE_BASE/skills/$skill_name"
    mkdir -p "$cache_skill_dir"
    if [ -f "$skill_dir/SKILL.md" ]; then
      cp -f "$skill_dir/SKILL.md" "$cache_skill_dir/SKILL.md"
    fi
    if [ -d "$skill_dir/references" ]; then
      cp -rf "$skill_dir/references" "$cache_skill_dir/"
    fi
  done

  # Register in known_marketplaces.json if missing
  KM_FILE="$HOME/.claude/plugins/known_marketplaces.json"
  if [ ! -f "$KM_FILE" ]; then
    echo '{}' > "$KM_FILE"
  fi
  HAS_AI_COMPANY=$(jq 'has("ai-company")' "$KM_FILE" 2>/dev/null || echo "false")
  MP_LOCATION="$HOME/.claude/plugins/marketplaces/ai-company"
  if [ "$HAS_AI_COMPANY" != "true" ]; then
    mkdir -p "$MP_LOCATION"
    jq --arg loc "$MP_LOCATION" \
      '. + {"ai-company": {"source": {"source": "github", "repo": "boku-miyaji/claude_dev"}, "installLocation": $loc, "lastUpdated": (now | todate)}}' \
      "$KM_FILE" > "$KM_FILE.tmp" && mv "$KM_FILE.tmp" "$KM_FILE"
  fi

  # Sync root marketplace.json to marketplace directory (required for skill discovery)
  if [ -f "$PROJECT_DIR/.claude-plugin/marketplace.json" ]; then
    mkdir -p "$MP_LOCATION/.claude-plugin"
    cp -f "$PROJECT_DIR/.claude-plugin/marketplace.json" "$MP_LOCATION/.claude-plugin/marketplace.json"
  fi
  # Sync skills to marketplace directory so Claude Code can resolve skill paths
  for skill_dir in "$SOURCE_BASE"/skills/*/; do
    [ -d "$skill_dir" ] || continue
    skill_name=$(basename "$skill_dir")
    mp_skill_dir="$MP_LOCATION/plugins/company/skills/$skill_name"
    mkdir -p "$mp_skill_dir"
    if [ -f "$skill_dir/SKILL.md" ]; then
      cp -f "$skill_dir/SKILL.md" "$mp_skill_dir/SKILL.md"
    fi
    if [ -d "$skill_dir/references" ]; then
      cp -rf "$skill_dir/references" "$mp_skill_dir/"
    fi
  done

  # Register in installed_plugins.json if missing
  IP_FILE="$HOME/.claude/plugins/installed_plugins.json"
  if [ ! -f "$IP_FILE" ]; then
    echo '{"version": 2, "plugins": {}}' > "$IP_FILE"
  fi
  HAS_PLUGIN=$(jq '.plugins | has("company@ai-company")' "$IP_FILE" 2>/dev/null || echo "false")
  # Fix existing entry if scope is wrong (user → project with projectPath)
  if [ "$HAS_PLUGIN" = "true" ]; then
    CURRENT_SCOPE=$(jq -r '.plugins["company@ai-company"][0].scope // ""' "$IP_FILE" 2>/dev/null)
    CURRENT_PROJPATH=$(jq -r '.plugins["company@ai-company"][0].projectPath // ""' "$IP_FILE" 2>/dev/null)
    if [ "$CURRENT_SCOPE" != "project" ] || [ "$CURRENT_PROJPATH" != "$PROJECT_DIR" ]; then
      NOW=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
      jq --arg path "$CACHE_BASE" --arg now "$NOW" --arg projpath "$PROJECT_DIR" \
        '.plugins["company@ai-company"] = [{"scope": "project", "installPath": $path, "version": "1.0.0", "installedAt": $now, "lastUpdated": $now, "projectPath": $projpath}]' \
        "$IP_FILE" > "$IP_FILE.tmp" && mv "$IP_FILE.tmp" "$IP_FILE"
    fi
  fi
  if [ "$HAS_PLUGIN" != "true" ]; then
    NOW=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
    jq --arg path "$CACHE_BASE" --arg now "$NOW" --arg projpath "$PROJECT_DIR" \
      '.plugins["company@ai-company"] = [{"scope": "project", "installPath": $path, "version": "1.0.0", "installedAt": $now, "lastUpdated": $now, "projectPath": $projpath}]' \
      "$IP_FILE" > "$IP_FILE.tmp" && mv "$IP_FILE.tmp" "$IP_FILE"
  fi
fi

# Sync slash commands (diff-based)
"$SCRIPT_DIR/sync-slash-commands.sh" "$PROJECT_DIR" 2>/dev/null || true

# Log sync activity
ACTIVITY=$(jq -n \
  --arg action "hook_sync" \
  --arg description "SessionStart hook: config synced to dashboard" \
  --argjson metadata "$(jq -n --arg scope "$SCOPE" --arg source "hook" '{scope: $scope, source: $source}')" \
  '{action: $action, description: $description, metadata: $metadata}')

curl -4 -s -o /dev/null -w "" \
  "${SUPABASE_URL}/rest/v1/activity_log" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -H "x-ingest-key: ${SUPABASE_INGEST_KEY}" \
  -d "$ACTIVITY" \
  --connect-timeout 10 \
  --max-time 15 \
  2>/dev/null || true

exit 0
