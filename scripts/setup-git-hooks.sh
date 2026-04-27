#!/usr/bin/env bash
# setup-git-hooks.sh — install pre-push hook (idempotent)
#
# Usage: bash scripts/setup-git-hooks.sh
#
# Installs scripts/git-hooks/pre-push.sh as a symlink in .git/hooks/pre-push
# so the hook stays in sync with the committed source.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOK_SRC="$REPO_ROOT/scripts/git-hooks/pre-push.sh"
HOOKS_DIR="$(git -C "$REPO_ROOT" rev-parse --git-path hooks)"
HOOK_DST="$HOOKS_DIR/pre-push"

if [[ ! -f "$HOOK_SRC" ]]; then
  echo "❌ Hook source not found: $HOOK_SRC" >&2
  exit 1
fi

chmod +x "$HOOK_SRC"

# .git/hooks may be a relative path
mkdir -p "$HOOKS_DIR"

# Replace any existing pre-push (sample, file, or symlink) with a symlink to source
if [[ -e "$HOOK_DST" || -L "$HOOK_DST" ]]; then
  rm "$HOOK_DST"
fi

ln -s "$HOOK_SRC" "$HOOK_DST"

echo "✅ pre-push hook installed:"
echo "   $HOOK_DST -> $HOOK_SRC"
echo ""
echo "確認: 次回 push 時に company-dashboard/ への変更があれば typecheck + test が走ります。"
