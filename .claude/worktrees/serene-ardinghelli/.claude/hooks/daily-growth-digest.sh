#!/bin/bash
# daily-growth-digest.sh — 昨日の git log + prompt_log から growth_events を生成
#
# daily-analysis-batch.sh から呼ばれる。
# 昨日1日分を generate-growth-for-day.sh に渡して処理。

set -uo pipefail

YESTERDAY=$(date -d "yesterday" +%Y-%m-%d)
GEN_SCRIPT="/workspace/scripts/growth/generate-growth-for-day.sh"

if [ ! -x "$GEN_SCRIPT" ]; then
  echo "daily-growth-digest: $GEN_SCRIPT not found"
  exit 0
fi

echo "daily-growth-digest: processing $YESTERDAY"
bash "$GEN_SCRIPT" "$YESTERDAY" daily-digest
