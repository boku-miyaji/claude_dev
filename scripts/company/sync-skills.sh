#!/usr/bin/env bash
# sync-skills.sh — Sync skills from source-of-truth to all cache locations
#
# Source of truth: ~/.claude/plugins/marketplaces/ai-company/
# Copies to:
#   - plugins/company/  (legacy nested location)
#   - cache/ai-company/company/*/  (all cache versions)
#
# Also auto-generates marketplace.json skills array from actual directories.
#
# Usage:
#   bash scripts/company/sync-skills.sh           # sync all
#   bash scripts/company/sync-skills.sh --check   # check only, no writes

set -uo pipefail

PLUGINS_DIR="${HOME}/.claude/plugins"
SOURCE="${PLUGINS_DIR}/marketplaces/ai-company"
SKILLS_DIR="${SOURCE}/plugins/company/skills"
MARKETPLACE_JSON="${SOURCE}/.claude-plugin/marketplace.json"

CHECK_ONLY=false
[[ "${1:-}" == "--check" ]] && CHECK_ONLY=true

# ============================================================
# Step 1: Auto-generate skills array in marketplace.json
# ============================================================

if [[ ! -d "$SKILLS_DIR" ]]; then
  echo "ERROR: Skills directory not found: $SKILLS_DIR" >&2
  exit 1
fi

# Collect skill dirs that have SKILL.md
SKILL_PATHS=()
for d in "$SKILLS_DIR"/*/; do
  [[ -f "${d}SKILL.md" ]] && SKILL_PATHS+=("./skills/$(basename "$d")")  # relative to plugin dir, not marketplace root
done

# Sort
IFS=$'\n' SKILL_PATHS=($(sort <<<"${SKILL_PATHS[*]}")); unset IFS

# Build JSON array
SKILLS_JSON=$(printf '%s\n' "${SKILL_PATHS[@]}" | jq -R . | jq -s .)

# Current skills in marketplace.json
CURRENT_SKILLS=$(jq '.plugins[0].skills' "$MARKETPLACE_JSON" 2>/dev/null)

if [[ "$SKILLS_JSON" != "$CURRENT_SKILLS" ]]; then
  echo "Skills array out of sync:"
  echo "  Filesystem: $(echo "$SKILLS_JSON" | jq -c .)"
  echo "  marketplace.json: $(echo "$CURRENT_SKILLS" | jq -c .)"
  if $CHECK_ONLY; then
    echo "  → Run without --check to fix"
  else
    # Update marketplace.json
    TMP=$(mktemp)
    jq --argjson skills "$SKILLS_JSON" '.plugins[0].skills = $skills' "$MARKETPLACE_JSON" > "$TMP"
    mv "$TMP" "$MARKETPLACE_JSON"
    echo "  → Updated marketplace.json"
  fi
else
  echo "Skills array: OK (${#SKILL_PATHS[@]} skills)"
fi

# ============================================================
# Step 2: Sync to all target locations
# ============================================================

TARGETS=(
  "${PLUGINS_DIR}/marketplaces/ai-company/plugins/company"
)

# Add all cache versions
for cache_dir in "${PLUGINS_DIR}/cache/ai-company/company"/*/; do
  [[ -d "$cache_dir" ]] && TARGETS+=("$cache_dir")
done

SYNCED=0
ERRORS=0

for target in "${TARGETS[@]}"; do
  target_marketplace="${target}/.claude-plugin/marketplace.json"
  target_skills="${target}/skills"

  # Sync marketplace.json
  if [[ -f "$target_marketplace" ]]; then
    if ! diff -q "$MARKETPLACE_JSON" "$target_marketplace" >/dev/null 2>&1; then
      if $CHECK_ONLY; then
        echo "OUT OF SYNC: $target_marketplace"
        ((ERRORS++))
      else
        mkdir -p "$(dirname "$target_marketplace")"
        cp "$MARKETPLACE_JSON" "$target_marketplace"
        echo "Synced: marketplace.json → $(echo "$target" | sed "s|$PLUGINS_DIR/||")"
        ((SYNCED++))
      fi
    fi
  fi

  # Sync skills
  for skill_dir in "$SKILLS_DIR"/*/; do
    skill_name=$(basename "$skill_dir")
    target_skill="${target_skills}/${skill_name}"

    if [[ ! -d "$target_skill" ]] || ! diff -q "${skill_dir}SKILL.md" "${target_skill}/SKILL.md" >/dev/null 2>&1; then
      if $CHECK_ONLY; then
        echo "OUT OF SYNC: ${target_skill}/SKILL.md"
        ((ERRORS++))
      else
        mkdir -p "$target_skill"
        cp -r "$skill_dir"* "$target_skill/"
        ((SYNCED++))
      fi
    fi
  done
done

echo ""
if $CHECK_ONLY; then
  if [[ $ERRORS -gt 0 ]]; then
    echo "CHECK FAILED: $ERRORS items out of sync"
    exit 1
  else
    echo "CHECK OK: All locations in sync"
  fi
else
  echo "Done: $SYNCED items synced"
fi
