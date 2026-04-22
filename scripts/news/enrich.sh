#!/bin/bash
# scripts/news/enrich.sh
#
# Enrich news_items rows (title_ja + Japanese summary) via Claude CLI.
# Replaces the OpenAI gpt-5-nano call inside supabase/functions/news-enrich.
# Called as a step of .github/workflows/news-collect.yml after news/collect.sh.
#
# Env:
#   SUPABASE_URL (required)
#   SUPABASE_SERVICE_ROLE_KEY (preferred) or SUPABASE_ANON_KEY + SUPABASE_INGEST_KEY
#   CLAUDE_CODE_OAUTH_TOKEN (GitHub Actions; flat-rate plan)
#
# Optional env:
#   NEWS_ENRICH_LIMIT   (default: 20)  max rows to process in one run
#   NEWS_ENRICH_TIMEOUT (default: 180) claude CLI timeout seconds

set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SUPABASE_ENV="${SUPABASE_ENV_FILE:-$HOME/.claude/hooks/supabase.env}"
if [ -f "$SUPABASE_ENV" ]; then
  # shellcheck disable=SC1090
  source "$SUPABASE_ENV"
fi

: "${SUPABASE_URL:?SUPABASE_URL is required}"
if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ] && [ -z "${SUPABASE_ANON_KEY:-}" ]; then
  echo "[news-enrich] either SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY is required" >&2
  exit 1
fi

if ! command -v claude &>/dev/null; then
  echo "[news-enrich] claude CLI not found on PATH" >&2
  exit 1
fi

python3 "${SCRIPT_DIR}/_enrich.py"
