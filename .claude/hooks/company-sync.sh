#!/bin/bash
# Hook: SessionStart → Supabase companies + departments
# Reads .company/registry.md and .company*/CLAUDE.md, syncs to Supabase.
# Called by config-sync.sh at the end, or standalone.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/supabase-check.sh"
[ "$SUPABASE_AVAILABLE" = "true" ] || exit 0

INPUT="${1:-}"
if [ -z "$INPUT" ]; then
  # If called standalone, use workspace
  PROJECT_DIR="${CLAUDE_PROJECT_DIR:-/workspace}"
else
  PROJECT_DIR="$INPUT"
fi

COMPANY_DIR="$PROJECT_DIR/.company"
[ -d "$COMPANY_DIR" ] || exit 0

# --- 1. Sync companies from registry.md + .company-*/CLAUDE.md ---

# Parse registry.md table rows (skip header rows)
REGISTRY="$COMPANY_DIR/registry.md"
if [ -f "$REGISTRY" ]; then
  # Extract PJ company rows: 6 data columns (id|name|desc|repo|date|status)
  # Filter: skip headers, separators, and rows with fewer columns (department table)
  grep '|' "$REGISTRY" | awk -F'|' 'NF >= 8 && $2 !~ /ID|--/ && $6 !~ /--/' | while IFS='|' read -r _ id name desc repo created status _rest; do
    id=$(echo "$id" | xargs)
    name=$(echo "$name" | xargs)
    desc=$(echo "$desc" | xargs)
    repo=$(echo "$repo" | xargs)
    created=$(echo "$created" | xargs)
    status=$(echo "$status" | xargs)

    [ -z "$id" ] && continue

    # Read company CLAUDE.md for config
    COMPANY_CLAUDE_MD=""
    COMPANY_CLAUDE_FILE="$PROJECT_DIR/.company-${id}/CLAUDE.md"
    if [ -f "$COMPANY_CLAUDE_FILE" ]; then
      COMPANY_CLAUDE_MD=$(cat "$COMPANY_CLAUDE_FILE")
    fi

    # Check for linked git repo
    GIT_REPO_URL=""
    if [ -d "$PROJECT_DIR/$repo/.git" ] 2>/dev/null; then
      GIT_REPO_URL=$(git -C "$PROJECT_DIR/$repo" remote get-url origin 2>/dev/null || echo "")
    fi

    PAYLOAD=$(jq -n \
      --arg id "$id" \
      --arg name "$name" \
      --arg description "$desc" \
      --arg server_path "$repo" \
      --arg git_repo_url "$GIT_REPO_URL" \
      --arg status "$status" \
      --arg claude_md "$COMPANY_CLAUDE_MD" \
      '{
        id: $id,
        name: $name,
        description: $description,
        server_path: $server_path,
        git_repo_url: $git_repo_url,
        status: $status,
        config: {claude_md: $claude_md}
      }')

    curl -4 -s -o /dev/null \
      "${SUPABASE_URL}/rest/v1/companies?on_conflict=id" \
      -H "apikey: ${SUPABASE_ANON_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
      -H "Content-Type: application/json" \
      -H "Prefer: return=minimal,resolution=merge-duplicates" \
      -H "x-ingest-key: ${SUPABASE_INGEST_KEY}" \
      -d "$PAYLOAD" \
      --connect-timeout 5 --max-time 10 2>/dev/null || true
  done
fi

# --- 2. Sync HD departments from .company/departments/*/CLAUDE.md ---

DEPT_DIR="$COMPANY_DIR/departments"
if [ -d "$DEPT_DIR" ]; then
  for dept_path in "$DEPT_DIR"/*/; do
    [ -d "$dept_path" ] || continue
    slug=$(basename "$dept_path")
    dept_claude_md=""
    if [ -f "$dept_path/CLAUDE.md" ]; then
      dept_claude_md=$(cat "$dept_path/CLAUDE.md")
    fi

    # Extract department name from first heading
    dept_name=$(head -5 "$dept_path/CLAUDE.md" 2>/dev/null | grep '^#' | head -1 | sed 's/^#\+ //')
    [ -z "$dept_name" ] && dept_name="$slug"

    # Extract teams from folder structure
    teams="[]"
    team_dirs=$(find "$dept_path" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; 2>/dev/null | sort)
    if [ -n "$team_dirs" ]; then
      teams=$(echo "$team_dirs" | jq -R -s 'split("\n") | map(select(length > 0))')
    fi

    # Determine type from slug
    case "$slug" in
      ai-dev) type="engineering" ;;
      sys-dev) type="engineering" ;;
      pm) type="management" ;;
      materials) type="creative" ;;
      research) type="analysis" ;;
      intelligence) type="analysis" ;;
      *) type="other" ;;
    esac

    # Use "hd" as company_id for HD-level departments
    PAYLOAD=$(jq -n \
      --arg company_id "hd" \
      --arg name "$dept_name" \
      --arg slug "$slug" \
      --arg type "$type" \
      --argjson teams "$teams" \
      --arg claude_md "$dept_claude_md" \
      '{
        company_id: $company_id,
        name: $name,
        slug: $slug,
        type: $type,
        teams: $teams,
        config: {claude_md: $claude_md}
      }')

    curl -4 -s -o /dev/null \
      "${SUPABASE_URL}/rest/v1/departments?on_conflict=company_id,slug" \
      -H "apikey: ${SUPABASE_ANON_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
      -H "Content-Type: application/json" \
      -H "Prefer: return=minimal,resolution=merge-duplicates" \
      -H "x-ingest-key: ${SUPABASE_INGEST_KEY}" \
      -d "$PAYLOAD" \
      --connect-timeout 5 --max-time 10 2>/dev/null || true
  done
fi

exit 0
