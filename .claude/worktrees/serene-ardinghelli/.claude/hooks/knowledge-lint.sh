#!/bin/bash
# Hook: SessionStart — ナレッジLint（日次品質チェック）
# 最終Lint実行から24時間以上経過していたら、additionalContext でリマインド
# async: true

set -euo pipefail

LINT_MARKER="/tmp/claude-knowledge-lint-last"
NOW=$(date +%s)

# Check if lint was run in the last 24 hours
if [ -f "$LINT_MARKER" ]; then
  LAST=$(cat "$LINT_MARKER")
  DIFF=$((NOW - LAST))
  if [ "$DIFF" -lt 86400 ]; then
    exit 0  # Already linted today
  fi
fi

# Mark as linted
echo "$NOW" > "$LINT_MARKER"

# Collect stale files (modified more than 30 days ago)
STALE_FILES=""
for dir in /workspace/.company/departments/*/; do
  [ -d "$dir" ] || continue
  dept=$(basename "$dir")
  while IFS= read -r -d '' f; do
    DAYS_OLD=$(( (NOW - $(stat -c %Y "$f" 2>/dev/null || echo $NOW)) / 86400 ))
    if [ "$DAYS_OLD" -gt 30 ]; then
      STALE_FILES="${STALE_FILES}\n  - ${f#/workspace/} (${DAYS_OLD}日前)"
    fi
  done < <(find "$dir" -name "*.md" -not -name "CLAUDE.md" -print0 2>/dev/null)
done

# Count orphaned files (not referenced from any other file)
ORPHANED=""
for f in /workspace/.company/departments/research/tech/*.md /workspace/.company/departments/research/market/*.md 2>/dev/null; do
  [ -f "$f" ] || continue
  BASENAME=$(basename "$f")
  REFS=$(grep -rl "$BASENAME" /workspace/.company/ 2>/dev/null | grep -v "$f" | wc -l)
  if [ "$REFS" -eq 0 ]; then
    ORPHANED="${ORPHANED}\n  - ${f#/workspace/}"
  fi
done

# Check CLAUDE.md sizes
LARGE_FILES=""
for f in /workspace/.company/CLAUDE.md /workspace/.company/departments/*/CLAUDE.md; do
  [ -f "$f" ] || continue
  LINES=$(wc -l < "$f")
  if [ "$LINES" -gt 100 ]; then
    LARGE_FILES="${LARGE_FILES}\n  - ${f#/workspace/} (${LINES}行)"
  fi
done

# Build report
REPORT=""
if [ -n "$STALE_FILES" ]; then
  REPORT="${REPORT}STALE (30日超未更新):${STALE_FILES}\n"
fi
if [ -n "$ORPHANED" ]; then
  REPORT="${REPORT}ORPHANED (他から参照なし):${ORPHANED}\n"
fi
if [ -n "$LARGE_FILES" ]; then
  REPORT="${REPORT}LARGE CLAUDE.md (100行超):${LARGE_FILES}\n"
fi

if [ -n "$REPORT" ]; then
  # Escape for JSON
  REPORT_JSON=$(echo -e "$REPORT" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))" 2>/dev/null || echo "\"lint report available\"")
  cat <<EOF
{
  "additionalContext": "Knowledge Lint Report (daily):\n${REPORT}ナレッジの品質を確認してください。staleファイルは更新 or アーカイブ、orphanedファイルはindex.mdに追記 or 削除を検討。"
}
EOF
fi

exit 0
