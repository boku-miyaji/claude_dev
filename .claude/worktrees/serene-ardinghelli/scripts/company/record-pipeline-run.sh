#!/usr/bin/env bash
# record-pipeline-run.sh — パイプライン実行結果を Supabase pipeline_runs に記録する
#
# Usage:
#   bash scripts/company/record-pipeline-run.sh \
#     --company-id   <company_id>      # 例: scotch / hd（省略可）
#     --type         <A|B|C|D|E>       # 必須: パイプライン種別
#     --task-id      <integer>         # tasks.id（省略可）
#     --summary      <text>            # タスク概要（省略可）
#     --mode         <full-auto|checkpoint|step-by-step>  # 省略可
#     --steps        <JSON>            # [{dept,step,estimated_min,actual_min,status}]（省略可）
#     --outcome      <success|partial|failure>  # 必須
#     --first-ok     <true|false>      # 一発OKだったか（省略可）
#     --corrections  <integer>         # 差し戻し回数（デフォルト: 0）
#     --estimated    <minutes>         # 見積もり合計分（省略可）
#     --actual       <minutes>         # 実績合計分（省略可）
#     --complexity   <small|medium|large>  # 省略可（デフォルト: medium）
#     --notes        <text>            # メモ（省略可）
#
# 戻り値:
#   常に exit 0（エラーが起きても会話をブロックしない）
#   成功時: 作成された pipeline_run の id を標準出力に出力
#   失敗時: エラーメッセージを標準エラーに出力

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../../.claude/hooks/supabase.env"

# --- デフォルト値 ---
COMPANY_ID=""
PIPELINE_TYPE=""
TASK_ID=""
TASK_SUMMARY=""
EXECUTION_MODE=""
STEPS="[]"
OUTCOME=""
FIRST_TIME_OK=""
CORRECTIONS=0
ESTIMATED=""
ACTUAL=""
COMPLEXITY="medium"
NOTES=""

# --- 引数パース ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    --company-id)   COMPANY_ID="$2";    shift 2 ;;
    --type)         PIPELINE_TYPE="$2"; shift 2 ;;
    --task-id)      TASK_ID="$2";       shift 2 ;;
    --summary)      TASK_SUMMARY="$2";  shift 2 ;;
    --mode)         EXECUTION_MODE="$2"; shift 2 ;;
    --steps)        STEPS="$2";         shift 2 ;;
    --outcome)      OUTCOME="$2";       shift 2 ;;
    --first-ok)     FIRST_TIME_OK="$2"; shift 2 ;;
    --corrections)  CORRECTIONS="$2";   shift 2 ;;
    --estimated)    ESTIMATED="$2";     shift 2 ;;
    --actual)       ACTUAL="$2";        shift 2 ;;
    --complexity)   COMPLEXITY="$2";    shift 2 ;;
    --notes)        NOTES="$2";         shift 2 ;;
    *) echo "Unknown option: $1" >&2; shift ;;
  esac
done

# --- バリデーション ---
if [[ -z "$PIPELINE_TYPE" ]]; then
  echo "ERROR: --type (A/B/C/D/E) is required" >&2
  exit 0
fi

if [[ -z "$OUTCOME" ]]; then
  echo "ERROR: --outcome (success/partial/failure) is required" >&2
  exit 0
fi

case "$PIPELINE_TYPE" in
  A|B|C|D|E) ;;
  *) echo "ERROR: --type must be A, B, C, D, or E" >&2; exit 0 ;;
esac

case "$OUTCOME" in
  success|partial|failure) ;;
  *) echo "ERROR: --outcome must be success, partial, or failure" >&2; exit 0 ;;
esac

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

# jq の存在確認
if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required but not installed" >&2
  exit 0
fi

# --- 見積もり精度の計算 ---
ACCURACY_PCT="null"
if [[ -n "$ESTIMATED" && -n "$ACTUAL" ]] && \
   [[ "$ESTIMATED" =~ ^[0-9]+(\.[0-9]+)?$ ]] && \
   [[ "$ACTUAL" =~ ^[0-9]+(\.[0-9]+)?$ ]] && \
   (( $(echo "$ESTIMATED > 0" | bc -l 2>/dev/null || echo 0) )); then
  ACCURACY_PCT=$(awk -v est="$ESTIMATED" -v act="$ACTUAL" 'BEGIN {
    diff = est - act; if (diff < 0) diff = -diff;
    pct = (1 - diff / est) * 100;
    if (pct < 0) pct = 0;
    printf "%.1f", pct
  }')
fi

# --- completed_at の設定 ---
COMPLETED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# --- JSON ペイロード構築 ---
# null 扱いが必要なオプションフィールドを安全に組み立てる
build_payload() {
  local payload
  payload=$(jq -n \
    --arg      pipeline_type      "$PIPELINE_TYPE" \
    --arg      complexity         "$COMPLEXITY" \
    --arg      outcome            "$OUTCOME" \
    --argjson  corrections_count  "$CORRECTIONS" \
    --argjson  steps              "$STEPS" \
    --arg      completed_at       "$COMPLETED_AT" \
    '{
      pipeline_type:     $pipeline_type,
      complexity:        $complexity,
      outcome:           $outcome,
      corrections_count: $corrections_count,
      steps:             $steps,
      completed_at:      $completed_at
    }')

  # オプションフィールドを条件付きで追加
  [[ -n "$COMPANY_ID"     ]] && payload=$(echo "$payload" | jq --arg v "$COMPANY_ID"    '. + {company_id: $v}')
  [[ -n "$TASK_SUMMARY"   ]] && payload=$(echo "$payload" | jq --arg v "$TASK_SUMMARY"  '. + {task_summary: $v}')
  [[ -n "$EXECUTION_MODE" ]] && payload=$(echo "$payload" | jq --arg v "$EXECUTION_MODE" '. + {execution_mode: $v}')
  [[ -n "$NOTES"          ]] && payload=$(echo "$payload" | jq --arg v "$NOTES"         '. + {notes: $v}')

  [[ -n "$TASK_ID" ]] && \
    payload=$(echo "$payload" | jq --argjson v "$TASK_ID" '. + {task_id: $v}')

  [[ "$ACCURACY_PCT" != "null" ]] && \
    payload=$(echo "$payload" | jq --argjson v "$ACCURACY_PCT" '. + {accuracy_pct: $v}')

  if [[ -n "$ESTIMATED" && "$ESTIMATED" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
    payload=$(echo "$payload" | jq --argjson v "$ESTIMATED" '. + {total_estimated_minutes: $v}')
  fi

  if [[ -n "$ACTUAL" && "$ACTUAL" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
    payload=$(echo "$payload" | jq --argjson v "$ACTUAL" '. + {total_actual_minutes: $v}')
  fi

  if [[ -n "$FIRST_TIME_OK" ]]; then
    local bool_val
    [[ "$FIRST_TIME_OK" == "true" ]] && bool_val="true" || bool_val="false"
    payload=$(echo "$payload" | jq --argjson v "$bool_val" '. + {first_time_ok: $v}')
  fi

  echo "$payload"
}

PAYLOAD=$(build_payload)

# --- Supabase REST API に INSERT ---
RESPONSE=$(curl -4 -s -w "\n%{http_code}" \
  -X POST "${SUPABASE_URL}/rest/v1/pipeline_runs" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -H "x-ingest-key: ${SUPABASE_INGEST_KEY}" \
  -d "$PAYLOAD" \
  --connect-timeout 5 \
  --max-time 10 \
  2>/dev/null) || {
    echo "ERROR: curl failed (network error)" >&2
    exit 0
  }

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [[ "$HTTP_CODE" == "201" ]]; then
  # 作成された ID を出力
  RUN_ID=$(echo "$BODY" | jq -r '.[0].id // empty' 2>/dev/null || echo "")
  if [[ -n "$RUN_ID" ]]; then
    echo "pipeline_run recorded: id=$RUN_ID type=$PIPELINE_TYPE outcome=$OUTCOME"
  else
    echo "pipeline_run recorded (id unknown)"
  fi
else
  echo "ERROR: Supabase returned HTTP $HTTP_CODE: $BODY" >&2
  exit 0
fi

exit 0
