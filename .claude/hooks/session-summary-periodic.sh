#!/bin/bash
# Hook: UserPromptSubmit — 10プロンプトごとにセッションサマリを更新
# async: true
# SessionStop に依存しない。クラッシュしてもサマリが残る。

set -uo pipefail

COUNTER_FILE="/tmp/claude-session-prompt-counter"
INTERVAL=10

# カウンターをインクリメント
COUNT=1
[ -f "$COUNTER_FILE" ] && COUNT=$(( $(cat "$COUNTER_FILE") + 1 ))
echo "$COUNT" > "$COUNTER_FILE"

# INTERVAL ごとに実行
[ $(( COUNT % INTERVAL )) -ne 0 ] && exit 0

# session-summary.sh を実行
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
bash "$SCRIPT_DIR/session-summary.sh" 2>/dev/null || true

exit 0
