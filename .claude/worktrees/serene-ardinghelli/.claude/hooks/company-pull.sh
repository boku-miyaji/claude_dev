#!/bin/bash
# Hook: UserPromptSubmit (matcher: /company) → git pull
# Ensures latest org data before company skill runs.

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
PROJECT_DIR="${CWD:-/workspace}"

cd "$PROJECT_DIR" || exit 0

# Only pull if this is a git repo with a remote
git remote -v &>/dev/null || exit 0

# Fast-forward only, don't block on conflicts
OUTPUT=$(git pull --ff-only origin main 2>&1) || true

# Show result only if something changed
if echo "$OUTPUT" | grep -q "Updating\|Fast-forward"; then
  echo "📥 git pull: 最新の組織データを取得しました"
  echo "$OUTPUT" | grep -E "^ |files? changed|Updating" | head -5
fi

exit 0
