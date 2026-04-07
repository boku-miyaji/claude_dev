#!/bin/bash
# Hook: UserPromptSubmit — 失敗・修正パターンを検出して growth_events に自動記録
# async: true
#
# 検出パターン:
# - バグ報告: 「バグ」「壊れ」「動かない」「エラー」「おかしい」
# - 修正指示: 「直して」「修正して」「なぜ」「なんで」
# - フラストレーション: 「意味ない」「使えない」「ダメ」「違う」
# - 繰り返し: 同じ修正を2回以上
#
# 検出したらファイルに記録。SessionStop で集計して growth_events に INSERT。

set -uo pipefail

INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // empty' 2>/dev/null || true)
[ -z "$PROMPT" ] && exit 0

# Skip short prompts (confirmations, greetings)
[ ${#PROMPT} -lt 15 ] && exit 0

GROWTH_DIR="/tmp/claude-growth-signals"
mkdir -p "$GROWTH_DIR" 2>/dev/null || true

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/supabase-check.sh" 2>/dev/null || true
[ "${SUPABASE_AVAILABLE:-false}" = "true" ] || exit 0

# LLM classification via Edge Function (gpt-5-nano)
PROMPT_SHORT=$(echo "$PROMPT" | head -c 300)
CLASSIFY_PAYLOAD=$(jq -n \
  --arg msg "$PROMPT_SHORT" \
  '{
    mode: "completion",
    model: "gpt-5-nano",
    max_tokens: 50,
    system_prompt: "Classify if this user message contains a failure signal. Reply with ONE JSON object:\n{\"signal\": \"none\" | \"bug_report\" | \"correction\" | \"frustration\" | \"missed_expectation\" | \"repeated_issue\"}\n\n- bug_report: user reports something broken, not working, error\n- correction: user asks to fix, asks why something failed\n- frustration: user expresses dissatisfaction with output quality\n- missed_expectation: user expected something to be done but it wasnt\n- repeated_issue: user says they asked the same thing before\n- none: normal request, no failure signal\n\nJSON only.",
    message: $msg,
    response_format: {"type": "json_object"}
  }')

RESULT=$(curl -s --max-time 8 \
  "${SUPABASE_URL}/functions/v1/ai-agent" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "$CLASSIFY_PAYLOAD" 2>/dev/null) || exit 0

SIGNAL=$(echo "$RESULT" | jq -r '.content // empty' 2>/dev/null | jq -r '.signal // "none"' 2>/dev/null)

if [ -n "$SIGNAL" ] && [ "$SIGNAL" != "none" ] && [ "$SIGNAL" != "null" ]; then
  TIMESTAMP=$(date -Iseconds)
  ENTRY="{\"ts\":\"$TIMESTAMP\",\"signal\":\"$SIGNAL\",\"prompt\":$(echo "$PROMPT_SHORT" | jq -Rs .)}"
  echo "$ENTRY" >> "$GROWTH_DIR/signals.jsonl"

  # Also persist immediately to local log (survives crashes)
  LOG_FILE="$HOME/.claude/logs/growth-signals.jsonl"
  mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
  echo "$ENTRY" >> "$LOG_FILE"

  # If 3+ signals accumulated, summarize and INSERT now (don't wait for SessionStop)
  SIGNAL_COUNT=$(wc -l < "$GROWTH_DIR/signals.jsonl" 2>/dev/null | tr -d ' ')
  if [ "$SIGNAL_COUNT" -ge 3 ]; then
    bash "$SCRIPT_DIR/growth-summarize.sh" &
  fi
fi

exit 0
