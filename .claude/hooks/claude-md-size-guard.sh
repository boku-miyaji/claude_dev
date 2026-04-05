#!/bin/bash
# Hook: PostToolUse (Edit|Write) — CLAUDE.md 肥大化防止
# CLAUDE.md ファイルが200行を超えた場合に警告を出力
# async: true (ブロックしない)

set -euo pipefail

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.filePath // empty' 2>/dev/null || true)

# CLAUDE.md ファイルへの書き込みでなければスキップ
if [[ "$FILE" != *"CLAUDE.md"* ]]; then
  exit 0
fi

# ファイルが存在しなければスキップ
if [ ! -f "$FILE" ]; then
  exit 0
fi

LINES=$(wc -l < "$FILE" | tr -d ' ')
THRESHOLD=200

if [ "$LINES" -gt "$THRESHOLD" ]; then
  cat <<EOF
{
  "additionalContext": "WARNING: ${FILE} は ${LINES} 行に肥大化しています（閾値: ${THRESHOLD}行、推奨: 60行以下）。手順的な記述を .claude/rules/ に分離してください。CLAUDE.md は方針・判断基準のみ記載すべきです。"
}
EOF
fi

exit 0
