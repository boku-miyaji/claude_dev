#!/bin/bash
# backfill-history.sh — 過去のgit log + prompt_log から growth_events を生成
#
# Usage:
#   ./backfill-history.sh                  # 最初のcommit日から今日まで
#   ./backfill-history.sh 2025-12-01       # 指定日から今日まで
#   ./backfill-history.sh 2025-12-01 2026-01-31  # 範囲指定

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="${REPO_DIR:-/workspace}"
cd "$REPO_DIR" || exit 1

# Determine date range
if [ -n "${1:-}" ]; then
  START_DATE="$1"
else
  # Earliest commit date
  START_DATE=$(git log --reverse --format=%ad --date=short 2>/dev/null | head -1)
fi
END_DATE="${2:-$(date +%Y-%m-%d)}"

[ -z "$START_DATE" ] && { echo "Could not determine start date"; exit 1; }

echo "=== Growth History Backfill ==="
echo "Range: $START_DATE → $END_DATE"
echo ""

TOTAL=0
INSERTED=0
FAILED=0
SKIPPED=0

d="$START_DATE"
while [[ "$d" < "$END_DATE" ]] || [[ "$d" == "$END_DATE" ]]; do
  TOTAL=$((TOTAL + 1))
  if bash "$SCRIPT_DIR/generate-growth-for-day.sh" "$d" backfill 2>&1 | tee /tmp/backfill-out.log; then
    if grep -q "no activity" /tmp/backfill-out.log; then
      SKIPPED=$((SKIPPED + 1))
    elif grep -q "already has" /tmp/backfill-out.log; then
      SKIPPED=$((SKIPPED + 1))
    elif grep -q "inserted" /tmp/backfill-out.log; then
      INSERTED=$((INSERTED + 1))
    fi
  else
    FAILED=$((FAILED + 1))
  fi
  d=$(date -d "$d + 1 day" +%Y-%m-%d)
done

echo ""
echo "=== Backfill Complete ==="
echo "Total days:     $TOTAL"
echo "With events:    $INSERTED"
echo "Skipped:        $SKIPPED"
echo "Failed:         $FAILED"
