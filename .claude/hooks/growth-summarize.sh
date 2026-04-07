#!/bin/bash
# Hook: SessionStop — セッション中の失敗シグナルを集計して growth_events に記録
# async: true
#
# growth-detector.sh が収集したシグナルを読み取り、
# LLM (Edge Function completion) で要約して growth_events に INSERT。

set -uo pipefail

GROWTH_DIR="/tmp/claude-growth-signals"
SIGNAL_FILE="$GROWTH_DIR/signals.jsonl"

# シグナルがなければスキップ
[ -f "$SIGNAL_FILE" ] && [ -s "$SIGNAL_FILE" ] || exit 0

SIGNAL_COUNT=$(wc -l < "$SIGNAL_FILE" | tr -d ' ')
[ "$SIGNAL_COUNT" -eq 0 ] && exit 0

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/supabase-check.sh" 2>/dev/null || true
[ "${SUPABASE_AVAILABLE:-false}" = "true" ] || { rm -f "$SIGNAL_FILE"; exit 0; }

# Read signals
SIGNALS=$(cat "$SIGNAL_FILE")

# Record to local file (always works, even if Supabase fails)
GROWTH_LOG="$HOME/.claude/logs/growth-signals.jsonl"
mkdir -p "$(dirname "$GROWTH_LOG")" 2>/dev/null || true
echo "$SIGNALS" >> "$GROWTH_LOG"

# LLM summarization is now handled by daily-analysis-batch.sh (Claude CLI)
# Here we just persist signals to local log for batch processing
echo "growth-summarize: $SIGNAL_COUNT signals saved for batch analysis"

# Clean up signals file
rm -f "$SIGNAL_FILE"

exit 0
