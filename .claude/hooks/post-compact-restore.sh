#!/bin/bash
# Hook: PostCompact — 重要コンテキストを再注入
# Context Compaction 後に、保存したセッション状態をadditionalContextとして注入

set -euo pipefail

STATE_FILE="/workspace/.company/secretary/.session-state.json"

if [ ! -f "$STATE_FILE" ]; then
  exit 0
fi

SAVED_AT=$(jq -r '.saved_at // "unknown"' "$STATE_FILE" 2>/dev/null || echo "unknown")
TODAY=$(jq -r '.today // "unknown"' "$STATE_FILE" 2>/dev/null || echo "unknown")

cat <<EOF
{
  "additionalContext": "⚠ Context Compaction が発生しました（${SAVED_AT}）。セッション状態ファイル: .company/secretary/.session-state.json を確認してください。今日は ${TODAY} です。直近の決定事項やパイプライン進捗がファイルに記録されていないか確認してから作業を続行してください。"
}
EOF

exit 0
