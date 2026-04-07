#!/bin/bash
# Hook: PostToolUse (Edit|Write) — Edge Function編集時に即座にデプロイ
# async: true
# ai-agent/index.ts が編集されたら自動デプロイ。他のファイルはスキップ。

set -uo pipefail

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.filePath // empty' 2>/dev/null || true)

# ai-agent/index.ts 以外はスキップ
case "$FILE" in
  */supabase/functions/ai-agent/index.ts) ;;
  *) exit 0 ;;
esac

MARKER="/tmp/claude-edge-function-deploying"
PROJECT_REF="akycymnahqypmtsfqhtr"

# 多重デプロイ防止（10秒以内の再実行をスキップ）
if [ -f "$MARKER" ]; then
  LAST=$(cat "$MARKER")
  NOW=$(date +%s)
  [ $((NOW - LAST)) -lt 10 ] && exit 0
fi
echo "$(date +%s)" > "$MARKER"

# Supabase Access Token — try multiple sources
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/supabase.env" 2>/dev/null || true

# Fallback: Supabase CLI token (from `npx supabase login`)
if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  SUPABASE_ACCESS_TOKEN=$(cat "$HOME/.supabase/access-token" 2>/dev/null || true)
fi

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  exit 0
fi

# デプロイ実行
cd /workspace/company-dashboard
export SUPABASE_ACCESS_TOKEN
RESULT=$(npx supabase functions deploy ai-agent --no-verify-jwt --project-ref "$PROJECT_REF" 2>&1)

if echo "$RESULT" | grep -q "Deployed"; then
  cat <<EOF
{
  "additionalContext": "Edge Function ai-agent を自動デプロイしました。変更は即座に反映されています。"
}
EOF
else
  cat <<EOF
{
  "additionalContext": "WARNING: Edge Function ai-agent のデプロイに失敗しました: $(echo "$RESULT" | tail -1 | tr '"' "'")"
}
EOF
fi

exit 0
