#!/bin/bash
# Hook: PreToolUse (Bash) — 危険コマンドをブロック
# Exit 2 = block, Exit 0 = allow

set -euo pipefail

# stdin から JSON を読む
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || true)

if [ -z "$COMMAND" ]; then
  exit 0
fi

# 危険パターンの検出
BLOCKED=""

# rm -rf / (ルート削除)
if echo "$COMMAND" | grep -qE 'rm\s+-rf\s+/\s*$'; then
  BLOCKED="rm -rf / は禁止されています"
fi

# git push --force to main/master
if echo "$COMMAND" | grep -qE 'git\s+push\s+.*--force.*\s+(main|master)'; then
  BLOCKED="main/master への force push は禁止されています"
fi

# git reset --hard (作業内容の消失リスク)
if echo "$COMMAND" | grep -qE 'git\s+reset\s+--hard'; then
  BLOCKED="git reset --hard は作業内容を消失させる可能性があります"
fi

# DROP TABLE / DROP DATABASE
if echo "$COMMAND" | grep -qiE '(DROP\s+TABLE|DROP\s+DATABASE)'; then
  BLOCKED="DROP TABLE/DATABASE は禁止されています"
fi

if [ -n "$BLOCKED" ]; then
  echo "$BLOCKED" >&2
  exit 2
fi

exit 0
