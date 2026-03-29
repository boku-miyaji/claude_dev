#!/bin/bash
# Hook: UserPromptSubmit → Supabase prompt_log
# Logs every user prompt to the company dashboard.
# Runs async so it never blocks the conversation.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/supabase-check.sh"
[ "$SUPABASE_AVAILABLE" = "true" ] || exit 0

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

# Server identification
SERVER_HOST=$(hostname -s 2>/dev/null || echo "unknown")

# Infer company_id from CWD (e.g. /workspace/.company-rikyu/ → rikyu)
COMPANY_ID=""
if echo "$CWD" | grep -qP '\.company-[a-z]'; then
  COMPANY_ID=$(echo "$CWD" | grep -oP '\.company-\K[a-z0-9-]+' | head -1)
fi
# Also infer from prompt content mentioning /company {name}
if [ -z "$COMPANY_ID" ]; then
  COMPANY_ID=$(echo "$PROMPT" | grep -oP '/company\s+\K[a-z0-9-]+' | head -1 || true)
fi
# Infer from prompt keywords if still empty
if [ -z "$COMPANY_ID" ]; then
  echo "$PROMPT" | grep -qi "rikyu\|りきゅう\|りそな\|proposal\|アンケート" && COMPANY_ID="rikyu"
fi
if [ -z "$COMPANY_ID" ]; then
  echo "$PROMPT" | grep -qi "回路\|circuit\|polaris\|図面\|暗黙知" && COMPANY_ID="circuit"
fi
if [ -z "$COMPANY_ID" ]; then
  echo "$PROMPT" | grep -qi "sompo\|foundry\|scotch\|SOMPOケア" && COMPANY_ID="foundry"
fi

# Auto-tag based on content
TAGS="[]"
TAG_LIST=()

# --- PJ auto-tagging (session-tagger) ---
echo "$PROMPT" | grep -qi "rikyu\|りきゅう\|りそな\|proposal\|アンケート\|営業支援\|設問\|集計" && TAG_LIST+=("pj:rikyu")
echo "$PROMPT" | grep -qi "回路\|circuit\|図面\|polaris\|暗黙知\|tacit" && TAG_LIST+=("pj:circuit")
echo "$PROMPT" | grep -qi "sompo\|foundry\|scotch\|SOMPOケア\|技術スタック\|RFI\|RFP\|Lakehouse" && TAG_LIST+=("pj:foundry")

# --- Activity type auto-tagging ---
echo "$PROMPT" | grep -qi "実装\|implement\|コード\|code\|関数\|function" && TAG_LIST+=("coding")
echo "$PROMPT" | grep -qi "テスト\|test" && TAG_LIST+=("test")
echo "$PROMPT" | grep -qi "バグ\|bug\|fix\|修正\|エラー\|error" && TAG_LIST+=("bugfix")
echo "$PROMPT" | grep -qi "設計\|design\|アーキ\|architect" && TAG_LIST+=("design")
echo "$PROMPT" | grep -qi "ドキュメント\|docs\|README\|説明" && TAG_LIST+=("docs")
echo "$PROMPT" | grep -qi "レビュー\|review\|PR" && TAG_LIST+=("review")
echo "$PROMPT" | grep -qi "デプロイ\|deploy\|リリース\|release" && TAG_LIST+=("deploy")
echo "$PROMPT" | grep -qi "質問\|教えて\|how\|what\|why\|？\|?" && TAG_LIST+=("question")
echo "$PROMPT" | grep -qi "リファクタ\|refactor\|整理\|cleanup" && TAG_LIST+=("refactor")
echo "$PROMPT" | grep -qi "company\|秘書\|組織\|タスク\|TODO\|ダッシュボード\|ブリーフィング" && TAG_LIST+=("company")
echo "$PROMPT" | grep -qi "pptx\|スライド\|資料作成\|プレゼン" && TAG_LIST+=("materials")
echo "$PROMPT" | grep -qi "調べ\|調査\|リサーチ\|研究\|競合" && TAG_LIST+=("research")

if [ ${#TAG_LIST[@]} -gt 0 ]; then
  TAGS=$(printf '%s\n' "${TAG_LIST[@]}" | jq -R . | jq -s .)
fi

# Build JSON payload (with server_host, cwd, company_id)
PAYLOAD=$(jq -n \
  --arg prompt "$PROMPT" \
  --arg context "$CONTEXT" \
  --argjson tags "$TAGS" \
  --arg server_host "$SERVER_HOST" \
  --arg cwd "$CWD" \
  --arg company_id "$COMPANY_ID" \
  '{prompt: $prompt, context: $context, tags: $tags, server_host: $server_host, cwd: $cwd}
   | if $company_id != "" then . + {company_id: $company_id} else . end')

# POST to Supabase
curl -4 -s -o /dev/null -w "" \
  "${SUPABASE_URL}/rest/v1/prompt_log" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -H "x-ingest-key: ${SUPABASE_INGEST_KEY}" \
  -d "$PAYLOAD" \
  --connect-timeout 10 \
  --max-time 15 \
  2>/dev/null || true

exit 0
