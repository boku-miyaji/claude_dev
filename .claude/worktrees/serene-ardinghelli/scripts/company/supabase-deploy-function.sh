#!/usr/bin/env bash
# supabase-deploy-function.sh — Deploy Edge Functions via Supabase CLI
# Uses SUPABASE_ACCESS_TOKEN (no interactive login needed)
#
# Usage:
#   bash scripts/company/supabase-deploy-function.sh                # deploy ai-agent
#   bash scripts/company/supabase-deploy-function.sh <slug>         # deploy specific function

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../../.claude/hooks/supabase.env"
PROJECT_DIR="${SCRIPT_DIR}/../../company-dashboard"

source "$ENV_FILE" 2>/dev/null || { echo "ERROR: $ENV_FILE not found" >&2; exit 1; }

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "ERROR: SUPABASE_ACCESS_TOKEN not set in supabase.env" >&2
  exit 1
fi

export SUPABASE_ACCESS_TOKEN
PROJECT_REF=$(echo "$SUPABASE_URL" | grep -oP 'https://\K[^.]+')
SLUG="${1:-ai-agent}"

echo "=== Supabase Edge Function Deploy ==="
echo "Project: ${PROJECT_REF}"
echo "Function: ${SLUG}"

cd "$PROJECT_DIR" && npx supabase functions deploy "$SLUG" --project-ref "$PROJECT_REF" --no-verify-jwt
