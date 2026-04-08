#!/bin/bash
# Hook: Stop → auto commit & push uncommitted changes
# Runs at session end so work is never lost.
# Designed to NOT interfere with explicit commits by Claude Code.

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
PROJECT_DIR="${CWD:-/workspace}"

cd "$PROJECT_DIR" || exit 0
git remote -v &>/dev/null || exit 0

# Skip if a commit was made very recently (within 30 seconds)
# This prevents auto-save from racing with Claude Code's explicit commits
LAST_COMMIT_TIME=$(git log -1 --format=%ct 2>/dev/null || echo 0)
NOW=$(date +%s)
if [ $((NOW - LAST_COMMIT_TIME)) -lt 30 ]; then
  # Recent explicit commit exists — just push it if needed
  git push origin main 2>/dev/null || true
  exit 0
fi

# Check for uncommitted changes (tracked files only)
if git diff --quiet HEAD 2>/dev/null && git diff --cached --quiet HEAD 2>/dev/null; then
  # No changes to tracked files — still push any unpushed commits
  UNPUSHED=$(git log origin/main..HEAD --oneline 2>/dev/null | wc -l)
  if [ "$UNPUSHED" -gt 0 ]; then
    git push origin main 2>/dev/null || true
  fi
  exit 0
fi

# Stage tracked changes only (no untracked files — those need explicit add)
git add -u 2>/dev/null || exit 0

# Double-check there's something staged
if git diff --cached --quiet HEAD 2>/dev/null; then
  exit 0
fi

# Commit
git commit -m "chore: auto-save session changes

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>" 2>/dev/null || exit 0

# Push (non-blocking, don't fail the hook)
git push origin main 2>/dev/null || true

exit 0
