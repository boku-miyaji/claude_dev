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

GROWTH_DIR="/tmp/claude-growth-signals"
mkdir -p "$GROWTH_DIR" 2>/dev/null || true

# Pattern detection
SIGNAL=""

# Bug reports
if echo "$PROMPT" | grep -qiE 'バグ|壊れ|動かない|エラーが出|表示されない|反映されない|おかしい|機能していない'; then
  SIGNAL="bug_report"
fi

# Correction requests
if echo "$PROMPT" | grep -qiE '直して|修正して|なぜ\?|なんで\?|原因.*調査|なぜ動かない'; then
  SIGNAL="${SIGNAL:+$SIGNAL,}correction"
fi

# Frustration
if echo "$PROMPT" | grep -qiE '意味ない|使えない|ダメ|全然違う|意図していない|わからない|見にくい'; then
  SIGNAL="${SIGNAL:+$SIGNAL,}frustration"
fi

# "Should have been done" pattern
if echo "$PROMPT" | grep -qiE 'したはず|なっていない|されていない|漏れ|忘れ'; then
  SIGNAL="${SIGNAL:+$SIGNAL,}missed_expectation"
fi

if [ -n "$SIGNAL" ]; then
  TIMESTAMP=$(date -Iseconds)
  PROMPT_SHORT=$(echo "$PROMPT" | head -c 200)
  echo "{\"ts\":\"$TIMESTAMP\",\"signal\":\"$SIGNAL\",\"prompt\":$(echo "$PROMPT_SHORT" | jq -Rs .)}" >> "$GROWTH_DIR/signals.jsonl"
fi

exit 0
