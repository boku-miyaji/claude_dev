#!/bin/bash
# Hook: PreCompact — 重要コンテキストをファイルに退避
# Context Compaction 前に、現在のセッション状態を保存する
# async: false (Compaction前に完了必須)

set -euo pipefail

STATE_FILE="/workspace/.company/secretary/.session-state.json"

# 現在の日時
NOW=$(date -Iseconds)
TODAY=$(date +%Y-%m-%d)

# セッション状態を構造化JSONで保存
cat > "$STATE_FILE" <<EOF
{
  "saved_at": "$NOW",
  "today": "$TODAY",
  "note": "Context Compaction により古い会話が圧縮されました。以下の情報を確認してください。",
  "reminders": [
    "タスク状態は Supabase tasks テーブルで確認",
    "直近の決定事項は secretary/notes/${TODAY}-decisions.md で確認",
    "パイプライン進捗があれば secretary/notes/ の最新ファイルで確認"
  ]
}
EOF

exit 0
