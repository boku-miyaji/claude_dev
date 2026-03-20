#!/bin/bash
# Scan ALL SKILL.md files (custom + marketplace + workspace + user),
# diff against local cache, upsert changes to Supabase.
# Called from config-sync.sh on SessionStart.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/supabase.env"

PROJECT_DIR="${1:-/workspace}"
CACHE_FILE="$SCRIPT_DIR/skills-cache.json"
HOME_DIR="${HOME:-/home/node}"
TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT

# --- Collect: source_label<TAB>path ---
{
  # 1. Custom plugins
  for f in "$PROJECT_DIR"/plugins/*/skills/*/SKILL.md; do
    [ -f "$f" ] || continue
    PNAME=$(echo "$f" | sed "s|$PROJECT_DIR/plugins/||" | cut -d'/' -f1)
    printf 'custom:%s\t%s\n' "$PNAME" "$f"
  done

  # 2. Workspace-level
  for f in "$PROJECT_DIR"/.claude/skills/*/SKILL.md; do
    [ -f "$f" ] || continue
    printf 'workspace\t%s\n' "$f"
  done

  # 3. User-level
  for f in "$HOME_DIR"/.claude/skills/*/SKILL.md; do
    [ -f "$f" ] || continue
    printf 'user\t%s\n' "$f"
  done

  # 4. Marketplace: anthropic-agent-skills
  for f in "$PROJECT_DIR"/.claude/plugins/marketplaces/anthropic-agent-skills/skills/*/SKILL.md; do
    [ -f "$f" ] || continue
    printf 'marketplace:anthropic-agent-skills\t%s\n' "$f"
  done

  # 5. Marketplace: claude-plugins-official/plugins
  for f in "$PROJECT_DIR"/.claude/plugins/marketplaces/claude-plugins-official/plugins/*/skills/*/SKILL.md; do
    [ -f "$f" ] || continue
    PNAME=$(echo "$f" | grep -oP 'plugins/\K[^/]+(?=/skills)' | tail -1 || echo "unknown")
    printf 'marketplace:%s\t%s\n' "$PNAME" "$f"
  done

  # 6. Marketplace: external_plugins
  for f in "$PROJECT_DIR"/.claude/plugins/marketplaces/claude-plugins-official/external_plugins/*/skills/*/SKILL.md; do
    [ -f "$f" ] || continue
    PNAME=$(echo "$f" | grep -oP 'external_plugins/\K[^/]+(?=/skills)' || echo "unknown")
    printf 'marketplace:%s\t%s\n' "$PNAME" "$f"
  done

  # 7. ai-company marketplace workspace skills
  for f in "$PROJECT_DIR"/.claude/plugins/marketplaces/ai-company/.claude/skills/*/SKILL.md; do
    [ -f "$f" ] || continue
    printf 'marketplace:ai-company\t%s\n' "$f"
  done
} > "$TMPFILE"

# --- Parse all SKILL.md frontmatters with awk (extract raw fields) then jq (safe JSON) ---
CURRENT_SKILLS=$(awk -F'\t' '
function auto_cat(name) {
  if (name == "company") return "organization"
  if (name == "permission") return "permission"
  if (name == "no-edit") return "utility"
  if (name ~ /commit|pr|push|review|clean/) return "workflow"
  if (name ~ /pdf|pptx|docx|xlsx|doc-co/) return "document"
  if (name ~ /design|frontend|canvas|art|theme|brand|web-artifact/) return "development"
  if (name ~ /explain|visualize|audit|devil/) return "analysis"
  if (name ~ /mcp|skill-creator|hook|plugin|config|setup/) return "utility"
  if (name ~ /slack|internal-comms/) return "communication"
  return "other"
}
function strip_yaml_quotes(s) {
  # Remove surrounding quotes and unescape
  if (substr(s,1,1) == "\"" && substr(s,length(s),1) == "\"") {
    s = substr(s, 2, length(s)-2)
    gsub(/\\"/, "\"", s)
  }
  if (substr(s,1,1) == "\x27" && substr(s,length(s),1) == "\x27") {
    s = substr(s, 2, length(s)-2)
  }
  return s
}
{
  source = $1
  path = $2
  fname = ""; ftrigger = ""; fdesc = ""; fcat = ""
  in_fm = 0; dashes = 0
  while ((getline line < path) > 0) {
    if (line == "---") { dashes++; if (dashes==1) {in_fm=1;continue}; if (dashes>=2) break }
    if (!in_fm) continue
    if (line ~ /^name:/) { sub(/^name:[[:space:]]*/, "", line); fname = strip_yaml_quotes(line) }
    else if (line ~ /^trigger:/) { sub(/^trigger:[[:space:]]*/, "", line); ftrigger = strip_yaml_quotes(line) }
    else if (line ~ /^description:/) { sub(/^description:[[:space:]]*/, "", line); sub(/^>[[:space:]]*/, "", line); fdesc = strip_yaml_quotes(line) }
    else if (line ~ /^category:/) { sub(/^category:[[:space:]]*/, "", line); fcat = strip_yaml_quotes(line) }
  }
  close(path)
  if (fname == "") next
  if (ftrigger == "") ftrigger = "/" fname
  if (fcat == "") fcat = auto_cat(fname)
  id = fname
  if (source !~ /^custom:/) id = source ":" fname
  # Output as tab-separated (jq handles escaping)
  printf "%s\t%s\t%s\t%s\t%s\t%s\n", id, ftrigger, fdesc, fcat, source, path
}' "$TMPFILE" | jq -R -s '
  [split("\n")[] | select(length > 0) | split("\t") |
   {id: .[0], trigger: .[1], description: (.[2] | if length > 200 then .[:200] else . end),
    category: .[3], source: .[4], source_path: .[5], status: "active"}
  ] | unique_by(.id)')

# Handle empty
[ -z "$CURRENT_SKILLS" ] && CURRENT_SKILLS="[]"

# --- Load cache ---
CACHED_SKILLS="[]"
if [ -f "$CACHE_FILE" ]; then
  CACHED_SKILLS=$(cat "$CACHE_FILE")
fi

# --- Diff ---
CURRENT_HASH=$(echo "$CURRENT_SKILLS" | jq -S '.' | md5sum | cut -d' ' -f1)
CACHED_HASH=$(echo "$CACHED_SKILLS" | jq -S '.' | md5sum | cut -d' ' -f1)

if [ "$CURRENT_HASH" = "$CACHED_HASH" ]; then
  exit 0
fi

# --- Batch upsert ---
curl -s -o /dev/null -w "" \
  "${SUPABASE_URL}/rest/v1/slash_commands?on_conflict=id" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal,resolution=merge-duplicates" \
  -d "$CURRENT_SKILLS" \
  --max-time 10 \
  2>/dev/null || true

# --- Mark removed as deprecated ---
REMOVED=$(echo "$CACHED_SKILLS" | jq -c --argjson current "$CURRENT_SKILLS" \
  '[.[] | select(.id as $id | ($current | map(.id) | index($id)) == null) | .id]')

if [ "$REMOVED" != "[]" ] && [ "$REMOVED" != "null" ] && [ -n "$REMOVED" ]; then
  echo "$REMOVED" | jq -r '.[]' | while read -r rid; do
    curl -s -o /dev/null \
      "${SUPABASE_URL}/rest/v1/slash_commands?id=eq.${rid}" \
      -X PATCH \
      -H "apikey: ${SUPABASE_ANON_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
      -H "Content-Type: application/json" \
      -H "Prefer: return=minimal" \
      -d '{"status": "deprecated"}' \
      --max-time 5 \
      2>/dev/null || true
  done
fi

# --- Update cache ---
echo "$CURRENT_SKILLS" | jq -S '.' > "$CACHE_FILE"

exit 0
