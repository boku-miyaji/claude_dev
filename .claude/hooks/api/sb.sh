#!/usr/bin/env bash
# sb.sh — Supabase API wrapper for CLI/Hook usage
#
# Usage:
#   sb.sh query "<SQL>"                      Management API: SQL実行（RLS迂回）
#   sb.sh get <table> ["<query-string>"]     REST GET（anon key）
#   sb.sh get-auth <table> ["<qs>"]          REST GET（anon + x-ingest-key、RLS通過）
#   sb.sh post <table> <json>                REST POST（anon + x-ingest-key）
#   sb.sh upsert <table> <on_conflict> <json> REST POST upsert（merge-duplicates）
#   sb.sh patch <table> "<qs>" <json>        REST PATCH（anon + x-ingest-key）
#   sb.sh delete <table> "<qs>"              REST DELETE（anon + x-ingest-key）
#   sb.sh fn <function-name> <json>          Edge Function 呼び出し（anon key）
#   sb.sh help                               ヘルプ表示
#
# 例:
#   sb.sh query "SELECT id, title FROM tasks WHERE status='open' LIMIT 5"
#   sb.sh get tasks "?status=eq.open&select=id,title&limit=5"
#   sb.sh post tasks '{"title":"新規タスク","status":"open"}'
#   sb.sh upsert artifacts file_path @body.json
#   sb.sh patch tasks "?id=eq.xxx" '{"status":"done"}'
#   sb.sh fn ai-agent '{"prompt":"hello"}'

set -euo pipefail

ENV_FILE="${SUPABASE_ENV_FILE:-$HOME/.claude/hooks/supabase.env}"
PROJECT_ID="akycymnahqypmtsfqhtr"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: env file not found: $ENV_FILE" >&2
  exit 2
fi
# shellcheck disable=SC1090
source "$ENV_FILE"

: "${SUPABASE_URL:?SUPABASE_URL not set in $ENV_FILE}"

usage() {
  sed -n '2,20p' "$0" | sed 's/^# //; s/^#//'
}

cmd="${1:-help}"
shift || true

case "$cmd" in
  query)
    : "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN not set}"
    sql="${1:?SQL required: sb.sh query \"<SQL>\"}"
    body=$(jq -cn --arg q "$sql" '{query:$q}')
    curl -sS -X POST \
      "https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query" \
      -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "$body"
    ;;

  get)
    : "${SUPABASE_ANON_KEY:?SUPABASE_ANON_KEY not set}"
    table="${1:?table required}"
    qs="${2:-}"
    curl -sS "${SUPABASE_URL}/rest/v1/${table}${qs}" \
      -H "apikey: ${SUPABASE_ANON_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}"
    ;;

  get-auth)
    : "${SUPABASE_ANON_KEY:?}"; : "${SUPABASE_INGEST_KEY:?}"
    table="${1:?table required}"
    qs="${2:-}"
    curl -sS "${SUPABASE_URL}/rest/v1/${table}${qs}" \
      -H "apikey: ${SUPABASE_ANON_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
      -H "x-ingest-key: ${SUPABASE_INGEST_KEY}"
    ;;

  post)
    : "${SUPABASE_ANON_KEY:?}"; : "${SUPABASE_INGEST_KEY:?}"
    table="${1:?table required}"
    body="${2:?json body required}"
    curl -sS -X POST "${SUPABASE_URL}/rest/v1/${table}" \
      -H "apikey: ${SUPABASE_ANON_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
      -H "x-ingest-key: ${SUPABASE_INGEST_KEY}" \
      -H "Content-Type: application/json" \
      -H "Prefer: return=representation" \
      -d "$body"
    ;;

  upsert)
    : "${SUPABASE_ANON_KEY:?}"; : "${SUPABASE_INGEST_KEY:?}"
    table="${1:?table required}"
    conflict="${2:?on_conflict column required (e.g. file_path)}"
    body="${3:?json body required (literal or @file)}"
    curl -sS -X POST "${SUPABASE_URL}/rest/v1/${table}?on_conflict=${conflict}" \
      -H "apikey: ${SUPABASE_ANON_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
      -H "x-ingest-key: ${SUPABASE_INGEST_KEY}" \
      -H "Content-Type: application/json" \
      -H "Prefer: return=representation,resolution=merge-duplicates" \
      -d "$body"
    ;;

  patch)
    : "${SUPABASE_ANON_KEY:?}"; : "${SUPABASE_INGEST_KEY:?}"
    table="${1:?table required}"
    qs="${2:?query-string required (e.g. \"?id=eq.xxx\")}"
    body="${3:?json body required}"
    curl -sS -X PATCH "${SUPABASE_URL}/rest/v1/${table}${qs}" \
      -H "apikey: ${SUPABASE_ANON_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
      -H "x-ingest-key: ${SUPABASE_INGEST_KEY}" \
      -H "Content-Type: application/json" \
      -H "Prefer: return=representation" \
      -d "$body"
    ;;

  delete)
    : "${SUPABASE_ANON_KEY:?}"; : "${SUPABASE_INGEST_KEY:?}"
    table="${1:?table required}"
    qs="${2:?query-string required}"
    curl -sS -X DELETE "${SUPABASE_URL}/rest/v1/${table}${qs}" \
      -H "apikey: ${SUPABASE_ANON_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
      -H "x-ingest-key: ${SUPABASE_INGEST_KEY}"
    ;;

  fn)
    : "${SUPABASE_ANON_KEY:?}"
    fn="${1:?function name required}"
    body="${2:-\{\}}"
    curl -sS -X POST "${SUPABASE_URL}/functions/v1/${fn}" \
      -H "apikey: ${SUPABASE_ANON_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
      -H "Content-Type: application/json" \
      -d "$body"
    ;;

  help|-h|--help|"")
    usage
    ;;

  *)
    echo "Unknown subcommand: $cmd" >&2
    usage >&2
    exit 1
    ;;
esac
