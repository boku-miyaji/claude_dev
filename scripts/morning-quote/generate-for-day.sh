#!/bin/bash
# generate-for-day.sh <USER_ID> <DATE>
#
# 1ユーザー・1日分の朝イチ名言を生成する全体オーケストレーション。
#
# フロー:
#   1. 冪等チェック（user_quote_deliveries に既に当日分があればスキップ）
#   2. 前日の日記+感情分析を取得（無ければスキップ）
#   3. Step 1: テーマ抽出（Claude CLI）
#   4. Step 2: 検索クエリ生成（Python、LLM不要）
#   5. Step 3: 候補取得（quotes キャッシュ検索 + 不足分は Claude CLI + WebSearch）
#   6. Step 4-5: スコアリング・選出
#   7. Step 6: user_quote_deliveries に INSERT
#
# Exit codes:
#   0 = 成功 or スキップ（日記なし等）
#   1 = エラー
#
# 仕様（CLAUDE.md 準拠）:
#   - Claude CLI (`claude --print`) のみ。API 直叩きはしない
#   - 日記0件 or Web検索0件の場合は skip（フォールバック名言は出さない）

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
  # GitHub Actions では env var 直接 export 前提
  : "${SUPABASE_URL:?SUPABASE_URL is required}"
  : "${SUPABASE_ANON_KEY:?SUPABASE_ANON_KEY is required}"
  : "${SUPABASE_INGEST_KEY:?SUPABASE_INGEST_KEY is required}"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

YESTERDAY=$(date -d "$DATE - 1 day" +%Y-%m-%d)

echo "[$DATE] user=$USER_ID: generating morning quote (yesterday=$YESTERDAY)..."

# ============================================================
# 1. 冪等チェック
# ============================================================
if [ "$USER_ID" = "NULL" ]; then
  # 単一ユーザー運用: user_id IS NULL でフィルタ
  EXISTING=$(curl -s "${SUPABASE_URL}/rest/v1/user_quote_deliveries?user_id=is.null&delivery_date=eq.${DATE}&select=id" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "x-ingest-key: ${SUPABASE_INGEST_KEY}")
else
  EXISTING=$(curl -s "${SUPABASE_URL}/rest/v1/user_quote_deliveries?user_id=eq.${USER_ID}&delivery_date=eq.${DATE}&select=id" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "x-ingest-key: ${SUPABASE_INGEST_KEY}")
fi
if [ -n "$EXISTING" ] && [ "$EXISTING" != "[]" ]; then
  echo "[$DATE] already delivered for user=$USER_ID, skip"
  exit 0
fi

# ============================================================
# 2. 前日の日記を取得
# ============================================================
DIARY_JSON=$(curl -s "${SUPABASE_URL}/rest/v1/diary_entries?entry_date=eq.${YESTERDAY}&order=updated_at.desc&limit=1&select=id,body,ai_summary,topics,wbi" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "x-ingest-key: ${SUPABASE_INGEST_KEY}")

if [ -z "$DIARY_JSON" ] || [ "$DIARY_JSON" = "[]" ]; then
  echo "[$DATE] no diary for $YESTERDAY, skip (no starter fallback by spec)"
  exit 0
fi

DIARY_ID=$(echo "$DIARY_JSON" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data[0]['id'] if data else '')
except Exception:
    print('')
")

if [ -z "$DIARY_ID" ]; then
  echo "[$DATE] diary parse failed, skip"
  exit 0
fi

# 日記本文が短すぎる場合はスキップ
DIARY_BODY_LEN=$(echo "$DIARY_JSON" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    body = data[0].get('body') or ''
    print(len(body))
except Exception:
    print(0)
")

if [ "$DIARY_BODY_LEN" -lt 20 ]; then
  echo "[$DATE] diary too short (${DIARY_BODY_LEN} chars), skip"
  exit 0
fi

# 感情分析（なくても OK）
EMOTION_JSON=$(curl -s "${SUPABASE_URL}/rest/v1/emotion_analysis?diary_entry_id=eq.${DIARY_ID}&order=created_at.desc&limit=1" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "x-ingest-key: ${SUPABASE_INGEST_KEY}" 2>/dev/null)
EMOTION_JSON="${EMOTION_JSON:-[]}"

# ============================================================
# 3. Step 1: テーマ抽出（Claude CLI）
# ============================================================
if ! command -v claude &>/dev/null; then
  echo "[$DATE] claude CLI not found, cannot proceed"
  exit 1
fi

THEMES_JSON=$(bash "${SCRIPT_DIR}/_extract_themes.sh" "$DIARY_JSON" "$EMOTION_JSON" "$YESTERDAY")
if [ -z "$THEMES_JSON" ] || [ "$THEMES_JSON" = "{}" ]; then
  echo "[$DATE] theme extraction failed, skip"
  exit 0
fi

echo "[$DATE] themes extracted"

# ============================================================
# 4. Step 2: 検索クエリ生成
# ============================================================
QUERIES=$(echo "$THEMES_JSON" | python3 "${SCRIPT_DIR}/_build_queries.py")
if [ -z "$QUERIES" ]; then
  echo "[$DATE] no queries built, skip"
  exit 0
fi

echo "[$DATE] $(echo "$QUERIES" | grep -c '^') queries built"

# ============================================================
# 5. Step 3: 候補取得（キャッシュ + Web検索）
# ============================================================
CANDIDATES=$(echo "$QUERIES" | python3 "${SCRIPT_DIR}/_fetch_candidates.py")
CAND_COUNT=$(echo "$CANDIDATES" | python3 -c "
import sys, json
try:
    print(len(json.load(sys.stdin)))
except Exception:
    print(0)
")

if [ "$CAND_COUNT" = "0" ]; then
  echo "[$DATE] no candidates, skip (web_search_empty)"
  exit 0
fi

echo "[$DATE] $CAND_COUNT candidates gathered"

# ============================================================
# 6. Step 4-5: スコアリング・選出
# ============================================================
PICKED=$(echo "$CANDIDATES" | python3 "${SCRIPT_DIR}/_score_and_pick.py" \
  --themes "$THEMES_JSON" \
  --user "$USER_ID")

if [ -z "$PICKED" ] || [ "$PICKED" = "null" ] || [ "$PICKED" = "{}" ]; then
  echo "[$DATE] scoring returned no winner, skip"
  exit 0
fi

# ============================================================
# 7. Step 6: user_quote_deliveries に INSERT
# ============================================================
python3 "${SCRIPT_DIR}/_insert_delivery.py" \
  --picked "$PICKED" \
  --user "$USER_ID" \
  --date "$DATE" \
  --diary-id "$DIARY_ID"

echo "[$DATE] ✓ delivered"
