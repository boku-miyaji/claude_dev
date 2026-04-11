#!/bin/bash
# Hook: SessionStart — 中断パイプラインの検出と復旧提案
# async: true
# pipeline_state テーブルで status='running' or 'paused' のレコードを検出し、
# additionalContext で通知する。

ENV_FILE="$HOME/.claude/hooks/supabase.env"
[ -f "$ENV_FILE" ] && source "$ENV_FILE" || exit 0
[ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ] || [ -z "$SUPABASE_INGEST_KEY" ] && exit 0

# Check for interrupted pipelines
RESULT=$(curl -s "${SUPABASE_URL}/rest/v1/pipeline_state?status=in.running,paused&select=session_id,pipeline_name,current_step,status,updated_at&order=updated_at.desc&limit=3" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "x-ingest-key: ${SUPABASE_INGEST_KEY}" 2>/dev/null)

# Check if any results
COUNT=$(echo "$RESULT" | jq 'length' 2>/dev/null)
[ -z "$COUNT" ] || [ "$COUNT" = "0" ] || [ "$COUNT" = "null" ] && exit 0

# Build summary
SUMMARY=$(echo "$RESULT" | jq -r '.[] | "- \(.pipeline_name) (step: \(.current_step), status: \(.status), last: \(.updated_at | .[:10]))"' 2>/dev/null)

cat <<CONTEXT
{
  "additionalContext": "⚠️ 【中断パイプライン検出】以下のパイプラインが途中です:\n${SUMMARY}\n\n社長に続行するか確認してください。続行する場合は agent_sessions から前工程の成果を取得して引き継ぎます。"
}
CONTEXT

exit 0
