#!/bin/bash
# Hook: Stop → auto commit & push uncommitted changes
# Runs at session end so work is never lost.

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
PROJECT_DIR="${CWD:-/workspace}"

cd "$PROJECT_DIR" || exit 0
git remote -v &>/dev/null || exit 0

# Skip if Claude Code is in the middle of an explicit commit workflow
# (lock file is created by the agent before staging, removed after commit)
LOCK_FILE="/tmp/claude-explicit-commit.lock"
if [ -f "$LOCK_FILE" ]; then
  LOCK_AGE=$(( $(date +%s) - $(stat -c %Y "$LOCK_FILE" 2>/dev/null || echo 0) ))
  # Only respect lock if it's less than 60 seconds old (prevents stale locks)
  if [ "$LOCK_AGE" -lt 60 ]; then
    exit 0
  fi
  rm -f "$LOCK_FILE"
fi

# Check for uncommitted changes (tracked files only)
if git diff --quiet HEAD 2>/dev/null && git diff --cached --quiet HEAD 2>/dev/null; then
  # No changes to tracked files
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

echo "📤 auto-push: セッション終了時に変更を自動保存・pushしました"

exit 0
