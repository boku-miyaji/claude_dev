#!/usr/bin/env bash
# sync-skills.sh — Sync skills from source-of-truth to .claude/skills/
#
# Source of truth: plugins/company/skills/
# Copies to: .claude/skills/ (project-level skills, always loaded by Claude Code)
#
# Usage:
#   bash scripts/company/sync-skills.sh           # sync all
#   bash scripts/company/sync-skills.sh --check   # check only, no writes

set -uo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-/workspace}"
SOURCE_SKILLS="$PROJECT_DIR/plugins/company/skills"
TARGET_SKILLS="$PROJECT_DIR/.claude/skills"

CHECK_ONLY=false
[[ "${1:-}" == "--check" ]] && CHECK_ONLY=true

if [[ ! -d "$SOURCE_SKILLS" ]]; then
  echo "ERROR: Skills directory not found: $SOURCE_SKILLS" >&2
  exit 1
fi

SYNCED=0
ERRORS=0
TOTAL=0

for skill_dir in "$SOURCE_SKILLS"/*/; do
  [[ -f "${skill_dir}SKILL.md" ]] || continue
  skill_name=$(basename "$skill_dir")
  ((TOTAL++))

  target_dir="$TARGET_SKILLS/$skill_name"

  # Check if sync needed
  if [[ ! -f "$target_dir/SKILL.md" ]] || ! diff -q "${skill_dir}SKILL.md" "$target_dir/SKILL.md" >/dev/null 2>&1; then
    if $CHECK_ONLY; then
      echo "OUT OF SYNC: $skill_name"
      ((ERRORS++))
    else
      mkdir -p "$target_dir"
      cp -r "$skill_dir"* "$target_dir/"
      # Copy references if present
      [[ -d "$skill_dir/references" ]] && cp -rf "$skill_dir/references" "$target_dir/"
      echo "Synced: $skill_name"
      ((SYNCED++))
    fi
  fi
done

echo ""
if $CHECK_ONLY; then
  if [[ $ERRORS -gt 0 ]]; then
    echo "CHECK FAILED: $ERRORS of $TOTAL skills out of sync"
    exit 1
  else
    echo "CHECK OK: All $TOTAL skills in sync"
  fi
else
  echo "Done: $SYNCED of $TOTAL skills synced"
fi
