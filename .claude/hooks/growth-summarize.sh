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

# Try LLM summarization via Edge Function
SIGNAL_TEXT=$(echo "$SIGNALS" | python3 -c "
import json,sys
lines = [json.loads(l) for l in sys.stdin if l.strip()]
for l in lines:
    print(f'[{l[\"signal\"]}] {l[\"prompt\"][:100]}')
" 2>/dev/null)

if [ -n "$SIGNAL_TEXT" ]; then
  PAYLOAD=$(python3 -c "
import json
signals = '''$SIGNAL_TEXT'''
print(json.dumps({
    'mode': 'completion',
    'model': 'gpt-5-nano',
    'max_tokens': 300,
    'system_prompt': 'セッション中のユーザー修正・バグ報告シグナルを分析し、以下のJSON形式で要約してください: {\"title\":\"簡潔なタイトル\",\"what_happened\":\"何が起きたか\",\"root_cause\":\"推定される原因\",\"countermeasure\":\"対策\"}。JSONのみ返してください。',
    'message': f'セッション中の失敗シグナル({len(signals.splitlines())}件):\n{signals}',
    'response_format': {'type': 'json_object'}
}))
" 2>/dev/null)

  if [ -n "$PAYLOAD" ]; then
    RESULT=$(curl -s --max-time 15 \
      "${SUPABASE_URL}/functions/v1/ai-agent" \
      -H "apikey: ${SUPABASE_ANON_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
      -H "Content-Type: application/json" \
      -d "$PAYLOAD" 2>/dev/null)

    CONTENT=$(echo "$RESULT" | python3 -c "import json,sys; print(json.loads(sys.stdin.read()).get('content',''))" 2>/dev/null)

    if [ -n "$CONTENT" ]; then
      # Insert to growth_events
      TODAY=$(date +%Y-%m-%d)
      GROWTH_PAYLOAD=$(echo "$CONTENT" | python3 -c "
import json,sys
c = json.loads(sys.stdin.read())
print(json.dumps({
    'event_date': '$TODAY',
    'event_type': 'failure',
    'category': 'ops',
    'severity': 'medium',
    'phase': 8,
    'title': c.get('title','session failure')[:200],
    'what_happened': c.get('what_happened','')[:500],
    'root_cause': c.get('root_cause','')[:500],
    'countermeasure': c.get('countermeasure','')[:500],
    'tags': ['auto-detected'],
    'status': 'new'
}))
" 2>/dev/null)

      if [ -n "$GROWTH_PAYLOAD" ]; then
        curl -s -o /dev/null --max-time 10 \
          -X POST "${SUPABASE_URL}/rest/v1/growth_events" \
          -H "apikey: ${SUPABASE_ANON_KEY}" \
          -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
          -H "Content-Type: application/json" \
          -H "Prefer: return=minimal" \
          -H "x-ingest-key: ${SUPABASE_INGEST_KEY}" \
          -d "$GROWTH_PAYLOAD" 2>/dev/null || true
      fi
    fi
  fi
fi

# Clean up signals file
rm -f "$SIGNAL_FILE"

exit 0
