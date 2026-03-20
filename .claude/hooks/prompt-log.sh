#!/bin/bash
# Hook: UserPromptSubmit → Supabase prompt_log
# Logs every user prompt to the company dashboard.
# Runs async so it never blocks the conversation.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/supabase.env"

# Read hook input from stdin
INPUT=$(cat)

PROMPT=$(echo "$INPUT" | jq -r '.prompt // empty')

# Skip empty or trivial confirmation prompts
if [ -z "$PROMPT" ]; then
  exit 0
fi

# Skip single-word confirmations (はい, OK, yes, etc.)
TRIMMED=$(echo "$PROMPT" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
case "$TRIMMED" in
  "はい"|"ok"|"OK"|"Ok"|"yes"|"Yes"|"YES"|"うん"|"了解"|"y"|"Y"|"n"|"N"|"いいえ"|"no"|"No")
    exit 0
    ;;
esac

# Extract context from CWD
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
CONTEXT=$(basename "$CWD" 2>/dev/null || echo "unknown")

# Auto-tag based on content
TAGS="[]"
TAG_LIST=()

# Detect common patterns for auto-tagging
echo "$PROMPT" | grep -qi "実装\|implement\|コード\|code\|関数\|function" && TAG_LIST+=("coding")
echo "$PROMPT" | grep -qi "テスト\|test" && TAG_LIST+=("test")
echo "$PROMPT" | grep -qi "バグ\|bug\|fix\|修正\|エラー\|error" && TAG_LIST+=("bugfix")
echo "$PROMPT" | grep -qi "設計\|design\|アーキ\|architect" && TAG_LIST+=("design")
echo "$PROMPT" | grep -qi "ドキュメント\|docs\|README\|説明" && TAG_LIST+=("docs")
echo "$PROMPT" | grep -qi "レビュー\|review\|PR" && TAG_LIST+=("review")
echo "$PROMPT" | grep -qi "デプロイ\|deploy\|リリース\|release" && TAG_LIST+=("deploy")
echo "$PROMPT" | grep -qi "質問\|教えて\|how\|what\|why\|？\|?" && TAG_LIST+=("question")
echo "$PROMPT" | grep -qi "リファクタ\|refactor\|整理\|cleanup" && TAG_LIST+=("refactor")
echo "$PROMPT" | grep -qi "company\|秘書\|組織\|タスク\|TODO" && TAG_LIST+=("company")

if [ ${#TAG_LIST[@]} -gt 0 ]; then
  TAGS=$(printf '%s\n' "${TAG_LIST[@]}" | jq -R . | jq -s .)
fi

# Build JSON payload
PAYLOAD=$(jq -n \
  --arg prompt "$PROMPT" \
  --arg context "$CONTEXT" \
  --argjson tags "$TAGS" \
  '{prompt: $prompt, context: $context, tags: $tags}')

# POST to Supabase
curl -s -o /dev/null -w "" \
  "${SUPABASE_URL}/rest/v1/prompt_log" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d "$PAYLOAD" \
  --max-time 5 \
  2>/dev/null || true

exit 0
