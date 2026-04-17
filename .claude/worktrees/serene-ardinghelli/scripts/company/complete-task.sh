#!/usr/bin/env bash
# complete-task.sh — tasks.status を done に更新し activity_log に記録する
#
# Usage:
#   bash scripts/company/complete-task.sh <task_id> [pipeline_run_id] [notes]
#
#   task_id         必須: tasks テーブルの id（整数）
#   pipeline_run_id 省略可: 紐づく pipeline_runs.id
#   notes           省略可: 完了メモ（activity_log の description に含める）
#
# 戻り値:
#   常に exit 0（エラーが起きても会話をブロックしない）

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../../.claude/hooks/supabase.env"

TASK_ID="${1:-}"
PIPELINE_RUN_ID="${2:-}"
NOTES="${3:-}"

# --- バリデーション ---
if [[ -z "$TASK_ID" ]]; then
  echo "Usage: complete-task.sh <task_id> [pipeline_run_id] [notes]" >&2
  exit 0
fi

if ! [[ "$TASK_ID" =~ ^[0-9]+$ ]]; then
  echo "ERROR: task_id must be a positive integer, got: $TASK_ID" >&2
  exit 0
fi

# --- 環境変数ロード ---
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: supabase.env not found at $ENV_FILE" >&2
  exit 0
fi

source "$ENV_FILE"

if [[ -z "${SUPABASE_URL:-}" ]] || [[ -z "${SUPABASE_ANON_KEY:-}" ]]; then
  echo "ERROR: SUPABASE_URL or SUPABASE_ANON_KEY not set" >&2
  exit 0
fi

if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required but not installed" >&2
  exit 0
fi

COMPLETED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# ============================================================
# 1. tasks テーブルを更新: status=done, completed_at=now()
# ============================================================

TASK_PAYLOAD=$(jq -n \
  --arg status       "done" \
  --arg completed_at "$COMPLETED_AT" \
  '{status: $status, completed_at: $completed_at}')

TASK_RESPONSE=$(curl -4 -s -w "\n%{http_code}" \
  -X PATCH "${SUPABASE_URL}/rest/v1/tasks?id=eq.${TASK_ID}" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -H "x-ingest-key: ${SUPABASE_INGEST_KEY}" \
  -d "$TASK_PAYLOAD" \
  --connect-timeout 5 \
  --max-time 10 \
  2>/dev/null) || {
    echo "ERROR: curl failed for tasks update (network error)" >&2
    exit 0
  }

TASK_HTTP=$(echo "$TASK_RESPONSE" | tail -1)
TASK_BODY=$(echo "$TASK_RESPONSE" | head -n -1)

if [[ "$TASK_HTTP" == "200" || "$TASK_HTTP" == "204" ]]; then
  echo "task #${TASK_ID} marked as done"
else
  echo "ERROR: tasks PATCH returned HTTP $TASK_HTTP: $TASK_BODY" >&2
  # activity_log へは試みるが、エラーは致命的ではない
fi

# ============================================================
# 2. activity_log に記録
# ============================================================

DESCRIPTION="タスク #${TASK_ID} 完了"
[[ -n "$NOTES" ]] && DESCRIPTION="${DESCRIPTION}: ${NOTES}"

METADATA_OBJ="{}"
if [[ -n "$PIPELINE_RUN_ID" ]] && [[ "$PIPELINE_RUN_ID" =~ ^[0-9]+$ ]]; then
  METADATA_OBJ=$(jq -n --argjson rid "$PIPELINE_RUN_ID" '{pipeline_run_id: $rid}')
fi

ACT_PAYLOAD=$(jq -n \
  --arg action      "task_completed" \
  --arg description "$DESCRIPTION" \
  --argjson metadata "$METADATA_OBJ" \
  '{action: $action, description: $description, metadata: $metadata}')

ACT_RESPONSE=$(curl -4 -s -w "\n%{http_code}" \
  -X POST "${SUPABASE_URL}/rest/v1/activity_log" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -H "x-ingest-key: ${SUPABASE_INGEST_KEY}" \
  -d "$ACT_PAYLOAD" \
  --connect-timeout 5 \
  --max-time 10 \
  2>/dev/null) || {
    echo "WARN: curl failed for activity_log insert (network error)" >&2
    exit 0
  }

ACT_HTTP=$(echo "$ACT_RESPONSE" | tail -1)
ACT_BODY=$(echo "$ACT_RESPONSE" | head -n -1)

if [[ "$ACT_HTTP" == "201" ]]; then
  echo "activity_log: task_completed for #${TASK_ID}"
else
  echo "WARN: activity_log INSERT returned HTTP $ACT_HTTP: $ACT_BODY" >&2
fi

exit 0
