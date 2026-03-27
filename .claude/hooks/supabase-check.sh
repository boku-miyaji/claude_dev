#!/bin/bash
# Shared helper: check supabase.env existence before sourcing.
# Usage: source "$(dirname "$0")/supabase-check.sh"
# Sets SUPABASE_AVAILABLE=true/false. If false, caller should exit 0.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUPABASE_ENV_FILE="$SCRIPT_DIR/supabase.env"

SUPABASE_AVAILABLE=false

if [ ! -f "$SUPABASE_ENV_FILE" ]; then
  # Return info for callers that want to warn
  SUPABASE_MISSING_REASON="supabase.env not found at $SUPABASE_ENV_FILE"
  return 0 2>/dev/null || exit 0
fi

# Source and validate
source "$SUPABASE_ENV_FILE"

if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_ANON_KEY:-}" ]; then
  SUPABASE_MISSING_REASON="SUPABASE_URL or SUPABASE_ANON_KEY is empty in supabase.env"
  return 0 2>/dev/null || exit 0
fi

# Quick connectivity test (1s timeout, just check HTTP response)
HTTP_CODE=$(curl -4 -s -o /dev/null -w "%{http_code}" \
  "${SUPABASE_URL}/rest/v1/" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  --connect-timeout 2 \
  --max-time 3 \
  2>/dev/null) || HTTP_CODE="000"

if [ "$HTTP_CODE" = "000" ]; then
  SUPABASE_MISSING_REASON="Supabase unreachable (network error)"
  return 0 2>/dev/null || exit 0
fi

SUPABASE_AVAILABLE=true
