#!/bin/bash
# Hook: Stop → prompt_log のステータスを更新
#
# 判定ロジック:
#   /tmp/claude-req-status.json あり    → done / partial (Claude が自己申告)
#   なし + tools-used.txt あり          → missed (ツール使ったのに書かなかった)
#   なし + tools-used.txt なし          → answered (Q&A)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/supabase-check.sh" 2>/dev/null || true
[ "${SUPABASE_AVAILABLE:-false}" = "true" ] || exit 0

STATUS_FILE="/tmp/claude-req-status.json"
TOOLS_FILE="/tmp/claude-tools-used.txt"

# セッションID取得
CLAUDE_CONFIG="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
SESSIONS_DIR="$CLAUDE_CONFIG/sessions"
SESSION_ID=""
if [ -d "$SESSIONS_DIR" ]; then
  LATEST=$(ls -t "$SESSIONS_DIR"/*.json 2>/dev/null | head -1)
  [ -n "$LATEST" ] && SESSION_ID=$(jq -r '.sessionId // empty' "$LATEST" 2>/dev/null)
fi
[ -z "$SESSION_ID" ] && exit 0

# ステータス判定
if [ -f "$STATUS_FILE" ]; then
  STATUS=$(jq -r '.status // "done"' "$STATUS_FILE" 2>/dev/null)
  SUMMARY=$(jq -r '.summary // ""' "$STATUS_FILE" 2>/dev/null | sed "s/'/''/g" | head -c 200)
  PENDING=$(jq -c '.pending // []' "$STATUS_FILE" 2>/dev/null)
  rm -f "$STATUS_FILE"
elif [ -f "$TOOLS_FILE" ] && [ -s "$TOOLS_FILE" ]; then
  STATUS="missed"
  SUMMARY=""
  PENDING="[]"
else
  STATUS="answered"
  SUMMARY=""
  PENDING="[]"
fi

# 直近の received エントリを PATCH
"$SCRIPT_DIR/api/sb.sh" query "
  UPDATE prompt_log
  SET
    status           = '${STATUS}',
    response_summary = NULLIF('${SUMMARY}', ''),
    pending_actions  = '${PENDING}'::jsonb
  WHERE id = (
    SELECT id FROM prompt_log
    WHERE session_id = '${SESSION_ID}'
      AND status = 'received'
    ORDER BY created_at DESC
    LIMIT 1
  )
" 2>/dev/null || true

exit 0
