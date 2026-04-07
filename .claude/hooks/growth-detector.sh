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

# Keyword-based signal detection (no LLM call — batch analysis later)
PROMPT_SHORT=$(echo "$PROMPT" | head -c 300)
SIGNAL="none"

if echo "$PROMPT_SHORT" | grep -qiP 'バグ|壊れ|動かない|エラー|error|broken|crash'; then
  SIGNAL="bug_report"
elif echo "$PROMPT_SHORT" | grep -qiP '直して|修正して|なぜ|なんで|fix|why.*not|違う.*やって'; then
  SIGNAL="correction"
elif echo "$PROMPT_SHORT" | grep -qiP '意味ない|使えない|ダメ|だめ|やめて|違う$|ちがう'; then
  SIGNAL="frustration"
elif echo "$PROMPT_SHORT" | grep -qiP 'さっきも|前も|何回も|また同じ|繰り返し'; then
  SIGNAL="repeated_issue"
elif echo "$PROMPT_SHORT" | grep -qiP 'なぜやらない|なんでやってない|忘れてる|抜けてる'; then
  SIGNAL="missed_expectation"
fi

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
