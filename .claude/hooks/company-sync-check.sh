#!/bin/bash
# Hook: SessionStart → Company sync check
# Compares Supabase companies table with local .company-*/ directories.
# Outputs warnings to stderr (shown to user) if mismatches are found.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/supabase.env"

# Read hook input from stdin
INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
PROJECT_DIR="${CWD:-/workspace}"

# Fetch active companies from Supabase
SUPABASE_COMPANIES=$(curl -s \
  "${SUPABASE_URL}/rest/v1/companies?select=id,name&status=eq.active&order=id.asc" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  --connect-timeout 10 \
  --max-time 15 \
  2>/dev/null) || exit 0

# Parse Supabase company IDs
SUPABASE_IDS=$(echo "$SUPABASE_COMPANIES" | jq -r '.[].id' 2>/dev/null | sort) || exit 0

# Find local .company-*/ directories
LOCAL_IDS=$(find "$PROJECT_DIR" -maxdepth 1 -type d -name '.company-*' 2>/dev/null | \
  sed "s|$PROJECT_DIR/.company-||" | sort) || LOCAL_IDS=""

# Also check registry.md
REGISTRY_FILE="$PROJECT_DIR/.company/registry.md"
REGISTRY_IDS=""
if [ -f "$REGISTRY_FILE" ]; then
  REGISTRY_IDS=$(grep -oP '^\| ([a-z0-9-]+) \|' "$REGISTRY_FILE" 2>/dev/null | \
    sed 's/| //;s/ |//' | grep -v '^ID$' | sort) || REGISTRY_IDS=""
fi

# Compare: Supabase vs Local directories
MISSING_LOCAL=""
MISSING_SUPABASE=""
MISSING_REGISTRY=""

for id in $SUPABASE_IDS; do
  if ! echo "$LOCAL_IDS" | grep -qx "$id"; then
    NAME=$(echo "$SUPABASE_COMPANIES" | jq -r ".[] | select(.id==\"$id\") | .name")
    MISSING_LOCAL="${MISSING_LOCAL}  - ${id} (${NAME}): Supabase にあるがローカルに .company-${id}/ がない\n"
  fi
  if [ -n "$REGISTRY_IDS" ] && ! echo "$REGISTRY_IDS" | grep -qx "$id"; then
    MISSING_REGISTRY="${MISSING_REGISTRY}  - ${id}: registry.md に未登録\n"
  fi
done

for id in $LOCAL_IDS; do
  if ! echo "$SUPABASE_IDS" | grep -qx "$id"; then
    MISSING_SUPABASE="${MISSING_SUPABASE}  - ${id}: ローカルにあるが Supabase に未登録\n"
  fi
done

# Output warnings if mismatches found
if [ -n "$MISSING_LOCAL" ] || [ -n "$MISSING_SUPABASE" ] || [ -n "$MISSING_REGISTRY" ]; then
  echo ""
  echo "⚠️ 会社同期チェック: 不整合を検出しました"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if [ -n "$MISSING_LOCAL" ]; then
    echo ""
    echo "🔴 ローカル未作成（Supabase にのみ存在）:"
    echo -e "$MISSING_LOCAL"
  fi

  if [ -n "$MISSING_SUPABASE" ]; then
    echo ""
    echo "🟡 Supabase 未登録（ローカルにのみ存在）:"
    echo -e "$MISSING_SUPABASE"
  fi

  if [ -n "$MISSING_REGISTRY" ]; then
    echo ""
    echo "🟠 registry.md 未登録:"
    echo -e "$MISSING_REGISTRY"
  fi

  echo ""
  echo "→ /company で「同期して」と指示してください"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi

exit 0
