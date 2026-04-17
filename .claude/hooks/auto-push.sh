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

# Stage tracked changes
git add -u 2>/dev/null || exit 0

# Stage safe untracked files so newly created sources are auto-committed too.
# .gitignore already filters out scratch/ and build artifacts; we add a defensive
# pattern + size filter here to avoid committing secrets, DB files, or huge binaries.
git ls-files --others --exclude-standard -z 2>/dev/null | while IFS= read -r -d '' file; do
  [ -z "$file" ] && continue
  case "$file" in
    *.env|*.env.*|*credentials*|*token.json|*.key|*.pem|*.p12|*.pfx) continue ;;
    *secret*|*private*) continue ;;
    *.sqlite|*.sqlite3|*.db) continue ;;
    *.mp4|*.mov|*.zip|*.tar|*.gz|*.tgz|*.7z|*.rar) continue ;;
  esac
  # Skip files larger than 5MB (large binaries, datasets, model weights)
  size=$(stat -c%s -- "$file" 2>/dev/null || echo 0)
  [ "$size" -gt 5242880 ] && continue
  git add -- "$file" 2>/dev/null || true
done

# Safety: unstage anything that still looks like secrets or dangerous files
# (second line of defense in case the untracked filter above missed something)
DANGEROUS_PATTERNS=(.env .env.* credentials* token.json *.key *.pem *.p12 *.pfx)
for pat in "${DANGEROUS_PATTERNS[@]}"; do
  git diff --cached --name-only 2>/dev/null | grep -i "$pat" | while read -r f; do
    git reset HEAD -- "$f" 2>/dev/null || true
  done
done

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
