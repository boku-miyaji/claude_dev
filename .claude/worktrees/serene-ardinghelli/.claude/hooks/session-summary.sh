#!/bin/bash
# Hook: Stop — セッション終了時に作業サマリを記録
# セッション中の .company/ 変更をSupabaseに記録

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/supabase-check.sh" 2>/dev/null || true

TODAY=$(TZ=Asia/Tokyo date +%Y-%m-%d)
TIMESTAMP=$(TZ=Asia/Tokyo date +%Y-%m-%dT%H:%M:%S)

# .company/ 配下の今日変更されたファイルを検出
WORKSPACE="${CLAUDE_PROJECT_DIR:-/workspace}"
CHANGED_FILES=$(find "$WORKSPACE/.company" "$WORKSPACE/.company-"* -name "*.md" -newer "/tmp/.claude-session-start" 2>/dev/null | head -20 || true)

if [ -z "$CHANGED_FILES" ]; then
  exit 0
fi

# サマリをローカルに記録
SUMMARY_FILE="$WORKSPACE/.company/secretary/notes/${TODAY}-session-summary.md"
if [ -f "$SUMMARY_FILE" ]; then
  # 追記
  cat >> "$SUMMARY_FILE" << EOF

---
## Session $TIMESTAMP

### 変更ファイル
$(echo "$CHANGED_FILES" | sed 's|^|- |')

EOF
else
  cat > "$SUMMARY_FILE" << EOF
# セッションサマリ - $TODAY

## Session $TIMESTAMP

### 変更ファイル
$(echo "$CHANGED_FILES" | sed 's|^|- |')

EOF
fi

# Supabase に記録（利用可能な場合）
if [ "${SUPABASE_AVAILABLE:-false}" = "true" ]; then
  FILE_LIST=$(echo "$CHANGED_FILES" | tr '\n' ', ' | sed 's/,$//')
  curl -s -X POST "${SUPABASE_URL}/rest/v1/activity_log" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"action\": \"session_end\",
      \"details\": \"Session ended. Changed files: ${FILE_LIST}\",
      \"created_at\": \"${TIMESTAMP}+09:00\"
    }" > /dev/null 2>&1 || true
fi

exit 0
