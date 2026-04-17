#!/usr/bin/env bash
# supabase-migrate.sh — Apply pending SQL migrations via exec_sql RPC
# Requires: service_role key + exec_sql function in Supabase
#
# Usage:
#   bash scripts/company/supabase-migrate.sh              # apply all pending
#   bash scripts/company/supabase-migrate.sh 041           # apply specific migration
#   bash scripts/company/supabase-migrate.sh --dry-run     # show pending without applying

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../../.claude/hooks/supabase.env"
MIGRATION_DIR="${SCRIPT_DIR}/../../company-dashboard"

# Load env
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found" >&2
  exit 1
fi
source "$ENV_FILE"

if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "ERROR: SUPABASE_SERVICE_ROLE_KEY not set in supabase.env" >&2
  exit 1
fi

run_sql() {
  local sql="$1"
  local response http_code body
  response=$(curl -4 -s -w "\n%{http_code}" -X POST "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"query\": $(echo "$sql" | jq -Rs .)}" 2>/dev/null)
  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | head -n -1)
  if [[ "$http_code" == "200" || "$http_code" == "201" ]]; then
    return 0
  else
    echo "$body" >&2
    return 1
  fi
}

echo "=== Supabase Migration Runner ==="
echo "URL: ${SUPABASE_URL}"

# Ensure tracking table exists
run_sql "CREATE TABLE IF NOT EXISTS _migrations (
  id serial PRIMARY KEY,
  name text UNIQUE NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);" 2>/dev/null || { echo "ERROR: exec_sql RPC not available. Create it in SQL Editor first." >&2; exit 1; }

# RLS for _migrations (service_role bypasses RLS, so this is just for safety)
run_sql "ALTER TABLE _migrations ENABLE ROW LEVEL SECURITY;" 2>/dev/null || true
run_sql "DO \$\$ BEGIN CREATE POLICY service_full ON _migrations FOR ALL TO authenticated USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END \$\$;" 2>/dev/null || true

# Get applied migrations
APPLIED=$(curl -4 -s "${SUPABASE_URL}/rest/v1/_migrations?select=name&order=name.asc" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" 2>/dev/null | jq -r '.[].name // empty' 2>/dev/null || echo "")

DRY_RUN=false
TARGET=""
for arg in "$@"; do
  if [[ "$arg" == "--dry-run" ]]; then DRY_RUN=true
  else TARGET="$arg"
  fi
done

# Find pending migrations
PENDING=0
APPLIED_COUNT=0
FAILED=0

for f in "$MIGRATION_DIR"/supabase-migration-*.sql; do
  [[ -f "$f" ]] || continue
  name=$(basename "$f")

  # Filter by target if specified
  if [[ -n "$TARGET" ]] && ! echo "$name" | grep -q "$TARGET"; then
    continue
  fi

  # Skip if already applied
  if echo "$APPLIED" | grep -q "^${name}$"; then
    ((APPLIED_COUNT++))
    continue
  fi

  ((PENDING++))

  if $DRY_RUN; then
    echo "  PENDING: $name"
    continue
  fi

  echo -n "  Applying: $name ... "
  SQL=$(cat "$f")

  if run_sql "$SQL"; then
    # Record as applied
    run_sql "INSERT INTO _migrations (name) VALUES ('${name}') ON CONFLICT DO NOTHING;" 2>/dev/null || true
    echo "OK"
    ((APPLIED_COUNT++))
  else
    echo "FAILED"
    ((FAILED++))
  fi
done

echo ""
if $DRY_RUN; then
  echo "Dry run: $PENDING pending, $APPLIED_COUNT already applied"
else
  echo "Done: $APPLIED_COUNT applied, $FAILED failed"
fi
