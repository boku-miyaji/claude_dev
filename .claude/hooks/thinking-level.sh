#!/bin/bash
# Hook: UserPromptSubmit → inject thinking-level keyword
#
# Default: [ultrathink] (max reasoning budget)
# Override by prefixing the prompt with one of:
#   xhigh   → ultrathink      (max)
#   high    → think harder    (high)
#   med     → think hard      (mid)
#   low     → think           (low)
#
# The prefix must be the first whitespace-delimited token of the prompt.
# Matching is case-insensitive. `medium` is also accepted as `med`.
#
# Injection is done via `hookSpecificOutput.additionalContext`, so the
# keyword is appended to the prompt context without mutating what the
# user typed. Failures are swallowed (exit 0) so the hook never blocks
# the conversation.

set -uo pipefail

INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // empty' 2>/dev/null || echo "")

# Empty prompt: do nothing (let downstream hooks handle it)
if [ -z "$PROMPT" ]; then
  exit 0
fi

# Default: max thinking
THINKING="ultrathink"
SOURCE="default"

# Inspect the very first token of the first non-empty line
FIRST_WORD=$(printf '%s\n' "$PROMPT" | awk 'NF{print tolower($1); exit}')

case "$FIRST_WORD" in
  xhigh)
    THINKING="ultrathink"
    SOURCE="override"
    ;;
  high)
    THINKING="think harder"
    SOURCE="override"
    ;;
  med|medium)
    THINKING="think hard"
    SOURCE="override"
    ;;
  low)
    THINKING="think"
    SOURCE="override"
    ;;
esac

# Emit JSON so Claude Code appends the keyword to the prompt context.
# The `[keyword]` token is the documented trigger form for extended thinking.
jq -n \
  --arg thinking "[$THINKING]" \
  --arg source "$SOURCE" \
  '{
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: ("Thinking level directive (" + $source + "): " + $thinking)
    }
  }' 2>/dev/null || true

exit 0
