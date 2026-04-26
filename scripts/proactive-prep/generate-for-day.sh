#!/bin/bash
# generate-for-day.sh <USER_ID> <DATE>
#
# 1ユーザー・1日分の proactive prelude を生成する全体オーケストレーション。
#
# フロー:
#   1. 冪等チェック（proactive_preparations に当日分があればスキップ）
#   2. シグナル評価（_detect_kind.py）→ kind を決定 or skip
#   3. Claude CLI で本文生成（_generate_prelude.sh）
#   4. INSERT proactive_preparations + agent_sessions audit log（_insert_preparation.py）
#
# Exit codes:
#   0 = 成功 or skip（シグナル無し等）
#   1 = エラー
#
# 仕様:
#   - Claude CLI (`claude --print`) のみ。API 直叩きはしない（CLAUDE.md ルール）
#   - シグナルが立たないときは何もしない（silence-first を壊さない）

set -uo pipefail

USER_ID="${1:-}"
DATE="${2:-}"
if [ -z "$USER_ID" ] || [ -z "$DATE" ]; then
  echo "Usage: $0 <USER_ID> <DATE>"
  exit 1
fi

# Load Supabase env
SUPABASE_ENV="${SUPABASE_ENV_FILE:-$HOME/.claude/hooks/supabase.env}"
if [ -f "$SUPABASE_ENV" ]; then
  # shellcheck disable=SC1090
  source "$SUPABASE_ENV"
else
  : "${SUPABASE_URL:?SUPABASE_URL is required}"
  : "${SUPABASE_ANON_KEY:?SUPABASE_ANON_KEY is required}"
  : "${SUPABASE_INGEST_KEY:?SUPABASE_INGEST_KEY is required}"
fi

# RLS 対象の読み取りには service role が必要
READ_KEY="${SUPABASE_SERVICE_ROLE_KEY:-${SUPABASE_ANON_KEY}}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# モデル選択（app_config から）。失敗時は haiku（短文生成なので軽量で十分）
PREP_MODEL_ID=$(python3 -c "
import sys; sys.path.insert(0, '${SCRIPT_DIR}/../narrator')
import _lib
print(_lib.get_app_config('batch.proactive_prep_model', 'claude-haiku-4-5-20251001'))
" 2>/dev/null || echo "claude-haiku-4-5-20251001")

case "$PREP_MODEL_ID" in
  *opus*)   export PREP_CLI_MODEL="opus" ;;
  *sonnet*) export PREP_CLI_MODEL="sonnet" ;;
  *haiku*)  export PREP_CLI_MODEL="haiku" ;;
  *)        export PREP_CLI_MODEL="haiku" ;;
esac

echo "[$DATE] user=$USER_ID: evaluating proactive prelude signals..."

# ============================================================
# 1. 冪等チェック
# ============================================================
if [ "$USER_ID" = "NULL" ]; then
  EXISTING=$(curl -s "${SUPABASE_URL}/rest/v1/proactive_preparations?user_id=is.null&delivery_date=eq.${DATE}&select=id" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "x-ingest-key: ${SUPABASE_INGEST_KEY}")
else
  EXISTING=$(curl -s "${SUPABASE_URL}/rest/v1/proactive_preparations?user_id=eq.${USER_ID}&delivery_date=eq.${DATE}&select=id" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "x-ingest-key: ${SUPABASE_INGEST_KEY}")
fi
if [ -n "$EXISTING" ] && [ "$EXISTING" != "[]" ]; then
  echo "[$DATE] already prepared for user=$USER_ID, skip"
  exit 0
fi

# ============================================================
# 2. シグナル評価 → kind 決定
# ============================================================
DECISION=$(python3 "${SCRIPT_DIR}/_detect_kind.py" --user "$USER_ID" --date "$DATE")
KIND=$(echo "$DECISION" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('kind') or '')
except Exception:
    print('')
")

if [ -z "$KIND" ]; then
  echo "[$DATE] no signal — staying silent (silence-first)"
  exit 0
fi

echo "[$DATE] signal detected: kind=$KIND"

# ============================================================
# 3. 本文生成（Claude CLI）
# ============================================================
PRELUDE_JSON=$(bash "${SCRIPT_DIR}/_generate_prelude.sh" "$DECISION")
if [ -z "$PRELUDE_JSON" ] || [ "$PRELUDE_JSON" = "{}" ]; then
  echo "[$DATE] prelude generation failed, skip"
  exit 0
fi

# ============================================================
# 4. INSERT
# ============================================================
python3 "${SCRIPT_DIR}/_insert_preparation.py" \
  --decision "$DECISION" \
  --prelude "$PRELUDE_JSON" \
  --user "$USER_ID" \
  --date "$DATE"

echo "[$DATE] ✓ prelude prepared (kind=$KIND)"
