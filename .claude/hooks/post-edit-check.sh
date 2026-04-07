#!/bin/bash
# Hook: PostToolUse (Edit/Write) — 編集後の自動品質チェック
# 編集されたファイルの拡張子に応じて lint/型チェックを実行

set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)

if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

EXT="${FILE_PATH##*.}"
WORKSPACE="${CLAUDE_PROJECT_DIR:-/workspace}"
WARNINGS=""

case "$EXT" in
  ts|tsx)
    # TypeScript: tsconfig が存在する場合のみチェック
    PROJECT_DIR=$(dirname "$FILE_PATH")
    while [ "$PROJECT_DIR" != "/" ]; do
      if [ -f "$PROJECT_DIR/tsconfig.json" ]; then
        # tsc が利用可能かチェック
        if command -v npx &>/dev/null && [ -f "$PROJECT_DIR/node_modules/.bin/tsc" ]; then
          RESULT=$(cd "$PROJECT_DIR" && npx tsc --noEmit --pretty false 2>&1 | grep -c "error TS" || true)
          if [ "$RESULT" -gt 0 ]; then
            WARNINGS="TypeScript: ${RESULT} error(s) detected in project"
          fi
        fi
        break
      fi
      PROJECT_DIR=$(dirname "$PROJECT_DIR")
    done
    ;;
  py)
    # Python: ruff が利用可能な場合のみチェック
    if command -v ruff &>/dev/null; then
      RESULT=$(ruff check "$FILE_PATH" --quiet 2>&1 | head -5 || true)
      if [ -n "$RESULT" ]; then
        WARNINGS="Ruff: $(echo "$RESULT" | wc -l) issue(s) in $FILE_PATH"
      fi
    fi
    ;;
esac

# AI feature docs freshness check
AI_HOOKS="useEmotionAnalysis useSelfAnalysis useMorningBriefing useDreamDetection useWeeklyNarrative"
BASENAME=$(basename "$FILE_PATH" .ts)
BASENAME_TSX=$(basename "$FILE_PATH" .tsx)
for hook in $AI_HOOKS; do
  if [ "$BASENAME" = "$hook" ] || [ "$BASENAME_TSX" = "$hook" ]; then
    WARNINGS="${WARNINGS:+$WARNINGS\n}⚠️ AI機能のソースコードが変更されました。Blueprint ページ (Blueprint.tsx) と docs/ai-features/ の該当セクションも更新してください。"
    break
  fi
done

if [ -n "$WARNINGS" ]; then
  echo -e "$WARNINGS" >&2
fi

exit 0
