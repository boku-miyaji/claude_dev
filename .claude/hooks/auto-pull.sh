#!/bin/bash
# Hook: SessionStart → git pull --ff-only
# Ensures latest code at session start (any session, not just /company).

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
PROJECT_DIR="${CWD:-/workspace}"

cd "$PROJECT_DIR" || exit 0
git remote -v &>/dev/null || exit 0

OUTPUT=$(git pull --ff-only origin main 2>&1) || true

if echo "$OUTPUT" | grep -q "Updating\|Fast-forward"; then
  echo "📥 auto-pull: 最新コードを取得しました"
  echo "$OUTPUT" | grep -E "^ |files? changed|Updating" | head -5
fi

exit 0
