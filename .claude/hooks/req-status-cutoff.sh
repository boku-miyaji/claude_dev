#!/bin/bash
# Hook: SessionStart → 前セッションの未完了エントリを cut_off にマーク
#
# received のまま残っているエントリ = セッション切断で Stop が走らなかった
# 5分のバッファを設けて誤検知を防ぐ

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/supabase-check.sh" 2>/dev/null || true
[ "${SUPABASE_AVAILABLE:-false}" = "true" ] || exit 0

# 現セッションID取得
CLAUDE_CONFIG="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
SESSIONS_DIR="$CLAUDE_CONFIG/sessions"
CURRENT_SESSION_ID=""
if [ -d "$SESSIONS_DIR" ]; then
  LATEST=$(ls -t "$SESSIONS_DIR"/*.json 2>/dev/null | head -1)
  [ -n "$LATEST" ] && CURRENT_SESSION_ID=$(jq -r '.sessionId // empty' "$LATEST" 2>/dev/null)
fi
[ -z "$CURRENT_SESSION_ID" ] && exit 0

# 前セッションで received のまま = cut_off
"$SCRIPT_DIR/api/sb.sh" query "
  UPDATE prompt_log
  SET status = 'cut_off'
  WHERE status = 'received'
    AND session_id != '${CURRENT_SESSION_ID}'
    AND created_at < now() - interval '5 minutes'
" 2>/dev/null || true

# 残存ステータスファイル（前セッションのゴミ）を削除
rm -f /tmp/claude-req-status.json

exit 0
