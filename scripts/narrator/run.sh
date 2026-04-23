#!/bin/bash
# scripts/narrator/run.sh
#
# Daily entrypoint for narrator-update via Claude CLI (flat-rate plan).
# Replaces the scheduled invocation of supabase/functions/narrator-update.
# Each of the 5 modules has its own skip-if-recent guard, so a daily trigger
# is safe and idempotent.
#
# Env:
#   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_INGEST_KEY (fallback)
#   SUPABASE_SERVICE_ROLE_KEY (preferred for write access)
#   CLAUDE_CODE_OAUTH_TOKEN (GitHub Actions only; flat-rate plan)
#
# Exit codes:
#   0 = success (even if all modules were skipped)
#   1 = missing required env or claude CLI

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SUPABASE_ENV="${SUPABASE_ENV_FILE:-$HOME/.claude/hooks/supabase.env}"
if [ -f "$SUPABASE_ENV" ]; then
  # shellcheck disable=SC1090
  source "$SUPABASE_ENV"
fi

: "${SUPABASE_URL:?SUPABASE_URL is required}"
if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ] && [ -z "${SUPABASE_ANON_KEY:-}" ]; then
  echo "[narrator] either SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY is required" >&2
  exit 1
fi

if ! command -v claude &>/dev/null; then
  echo "[narrator] claude CLI not found on PATH" >&2
  exit 1
fi

cd "$SCRIPT_DIR"

MODULES=(
  "_arc_reader.py"
  "_theme_finder.py"
  "_chapter_generator.py"
  "_dream_detection.py"
  "_manual_refresh.py"
  "_self_analysis.py"
)

SUMMARY="{"
FIRST=1
for mod in "${MODULES[@]}"; do
  name="${mod#_}"; name="${name%.py}"
  echo "[narrator] running ${name}..."
  if OUT=$(python3 "$mod" 2>&1); then
    RESULT=$(echo "$OUT" | tail -n 1)
  else
    RESULT='{"error":"module_failed"}'
    echo "[narrator] ${name} failed:" >&2
    echo "$OUT" >&2
  fi
  echo "[narrator] ${name} -> ${RESULT}"
  if [ $FIRST -eq 0 ]; then SUMMARY="${SUMMARY},"; fi
  SUMMARY="${SUMMARY}\"${name}\":${RESULT}"
  FIRST=0
done
SUMMARY="${SUMMARY}}"

echo "[narrator] summary: ${SUMMARY}"

# Best-effort activity_log write (mirrors the Edge Function final log).
python3 - <<PY
import _lib, json, sys
try:
    summary = json.loads(${SUMMARY@Q})
    _lib.log_activity(
        "narrator_update",
        "narrator_update cli run",
        {"modules": summary, "run_at": _lib.iso_now()},
    )
except Exception as e:
    sys.stderr.write(f"[narrator] activity_log write skipped: {e}\n")
PY

echo "[narrator] done"
