#!/bin/bash
# Hook: PreCompact — 重要コンテキストをファイルに退避
# Context Compaction 前に、現在のセッション状態を保存する
# async: false (Compaction前に完了必須)
#
# CLAUDE.md は Compaction を生き残るので退避不要。
# ここでは「セッション固有の動的状態」のみ保存する。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_FILE="/workspace/.company/secretary/.session-state.json"

# 現在の日時
NOW=$(date -Iseconds)
TODAY=$(date +%Y-%m-%d)

# 現在の作業ディレクトリ
WORK_DIR="${PWD:-/workspace}"

# 直近のgitコミット情報
GIT_INFO="unknown"
if git -C /workspace log -1 --format="%H %s" 2>/dev/null | grep -q .; then
  GIT_INFO=$(git -C /workspace log -1 --format="%H %s" 2>/dev/null)
fi

# Supabase から処理中タスクを取得（利用可能な場合）
ACTIVE_TASKS="[]"
source "$SCRIPT_DIR/supabase-check.sh" 2>/dev/null || true

if [ "${SUPABASE_AVAILABLE:-false}" = "true" ]; then
  ACTIVE_TASKS=$(curl -s \
    "${SUPABASE_URL}/rest/v1/tasks?status=eq.in_progress&select=id,title,description&limit=5" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    --connect-timeout 3 \
    --max-time 5 \
    2>/dev/null) || ACTIVE_TASKS="[]"

  # レスポンスが JSON 配列でない場合はフォールバック
  echo "$ACTIVE_TASKS" | jq -e 'type == "array"' >/dev/null 2>&1 || ACTIVE_TASKS="[]"
fi

# セッション状態を構造化JSONで保存
cat > "$STATE_FILE" <<EOF
{
  "saved_at": "$NOW",
  "today": "$TODAY",
  "work_dir": "$WORK_DIR",
  "git_last_commit": "$GIT_INFO",
  "active_tasks": $ACTIVE_TASKS,
  "note": "Context Compaction により古い会話が圧縮されました。以下の情報を確認してください。",
  "reminders": [
    "タスク状態は Supabase tasks テーブルで確認",
    "直近の決定事項は secretary/notes/${TODAY}-decisions.md で確認",
    "パイプライン進捗があれば secretary/notes/ の最新ファイルで確認",
    "active_tasks フィールドに処理中タスクが記録されています（Supabase接続時のみ）"
  ]
}
EOF

exit 0
