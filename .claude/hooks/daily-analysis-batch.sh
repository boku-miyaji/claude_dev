#!/bin/bash
# daily-analysis-batch.sh — 全定期分析の統合バッチ
#
# Claude Code CLI (haiku) で分析。APIコスト不要。
# /company 起動時 or セッション開始時に呼ばれる（24h間隔）。
#
# サブタスク:
#   1. プロンプト分類（未タグの Claude Code プロンプト）
#   2. 失敗シグナル要約（growth signals → growth_events）
#   3. スキル進化（prompt_log → skill_candidates）
#   4. 部署評価（activity_log + growth_events → evaluations）
#   5. ナレッジ昇格チェック（confidence >= 3）
#   6. CEO インサイト更新

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/supabase-check.sh" 2>/dev/null || true
[ "${SUPABASE_AVAILABLE:-false}" = "true" ] || { echo "Supabase unavailable"; exit 1; }

LAST_RUN_FILE="$SCRIPT_DIR/.daily-analysis-last-run"

# --- 24時間チェック（--force で強制実行） ---
if [ "${1:-}" != "--force" ] && [ -f "$LAST_RUN_FILE" ]; then
  LAST_EPOCH=$(date -d "$(cat "$LAST_RUN_FILE")" +%s 2>/dev/null || echo 0)
  NOW_EPOCH=$(date +%s)
  ELAPSED=$(( NOW_EPOCH - LAST_EPOCH ))
  if [ "$ELAPSED" -lt 86400 ]; then
    HOURS_AGO=$(( ELAPSED / 3600 ))
    echo "daily-analysis: last run ${HOURS_AGO}h ago (< 24h). Skip."
    exit 0
  fi
fi

echo "=== Daily Analysis Batch ==="
echo "$(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# ============================================================
# Task 1: プロンプト分類（未タグの Claude Code プロンプト）
# ============================================================
echo "--- [1/6] Prompt Classification ---"

UNTAGGED=$(curl -4 -s \
  "${SUPABASE_URL}/rest/v1/prompt_log?tags=eq.{}&select=id,prompt&order=created_at.desc&limit=50" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  --max-time 10 2>/dev/null)

# Also get prompts with only keyword tags (no LLM tags like pj:/dept:)
UNTAGGED2=$(curl -4 -s \
  "${SUPABASE_URL}/rest/v1/prompt_log?select=id,prompt,tags&order=created_at.desc&limit=100" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  --max-time 10 2>/dev/null | python3 -c "
import sys,json,re
data = json.load(sys.stdin)
# Filter: prompts that have no 'pj:' or 'dept:' tags (not yet LLM-classified)
result = []
for d in data:
    tags = d.get('tags', []) or []
    has_llm = any(t.startswith('pj:') or t.startswith('dept:') for t in tags)
    if not has_llm and len(d.get('prompt','')) > 10:
        p = re.sub(r'<[^>]+>', '', d['prompt']).strip()[:100]
        if p:
            result.append({'id': d['id'], 'prompt': p})
json.dump(result[:50], sys.stdout, ensure_ascii=False)
" 2>/dev/null)

UNTAGGED_COUNT=$(echo "$UNTAGGED2" | jq 'length' 2>/dev/null || echo 0)

if [ "$UNTAGGED_COUNT" -gt 0 ] && [ "$UNTAGGED_COUNT" != "null" ]; then
  PROMPTS_FOR_CLASSIFY=$(echo "$UNTAGGED2" | jq -c '[.[] | {id, prompt}]')

  CLASSIFY_RESULT=$(echo "Classify each prompt. For each, output JSON with id and tags.
Tags to assign:
- pj: project (rikyu/circuit/foundry or null)
- intent: implement/fix/investigate/design/review/brainstorm/manage/info/chat
- dept: ai-dev/sys-dev/security/materials/intelligence/research/ux-design/pm/ops/secretary or null
- cat: feature/infra/docs/quality/ops or null

Prompts: ${PROMPTS_FOR_CLASSIFY}

Reply ONLY valid JSON array: [{\"id\": N, \"pj\": ..., \"intent\": ..., \"dept\": ..., \"cat\": ...}]" | claude --print --model opus 2>/dev/null)

  # Extract JSON
  CLASSIFY_JSON=$(echo "$CLASSIFY_RESULT" | python3 -c "
import sys,json,re
text = sys.stdin.read()
# Try direct parse
try:
    json.loads(text)
    print(text)
    sys.exit(0)
except: pass
# Try extracting from code block
m = re.search(r'\[.*\]', text, re.DOTALL)
if m:
    try:
        json.loads(m.group())
        print(m.group())
    except:
        print('[]')
else:
    print('[]')
" 2>/dev/null)

  # Update each prompt's tags
  UPDATED=0
  echo "$CLASSIFY_JSON" | jq -c '.[]' 2>/dev/null | while IFS= read -r item; do
    PID=$(echo "$item" | jq -r '.id')
    NEW_TAGS=$(echo "$item" | jq -c '[
      (if .pj and .pj != "null" then "pj:" + .pj else empty end),
      (if .intent and .intent != "null" then "intent:" + .intent else empty end),
      (if .dept and .dept != "null" then "dept:" + .dept else empty end),
      (if .cat and .cat != "null" then "cat:" + .cat else empty end)
    ]')

    [ "$NEW_TAGS" = "[]" ] && continue

    curl -4 -s -o /dev/null \
      "${SUPABASE_URL}/rest/v1/prompt_log?id=eq.${PID}" \
      -X PATCH \
      -H "apikey: ${SUPABASE_ANON_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
      -H "Content-Type: application/json" \
      -H "Prefer: return=minimal" \
      -d "{\"tags\": $NEW_TAGS}" \
      --max-time 5 2>/dev/null || true

    UPDATED=$((UPDATED + 1))
  done
  echo "  Classified: ${UNTAGGED_COUNT} prompts"
else
  echo "  No untagged prompts"
fi

# ============================================================
# Task 2: 失敗シグナル要約（growth signals → growth_events）
# ============================================================
echo "--- [2/6] Growth Signal Summary ---"

GROWTH_LOG="$HOME/.claude/logs/growth-signals.jsonl"
if [ -f "$GROWTH_LOG" ] && [ -s "$GROWTH_LOG" ]; then
  SIGNAL_COUNT=$(wc -l < "$GROWTH_LOG" | tr -d ' ')
  if [ "$SIGNAL_COUNT" -gt 0 ]; then
    SIGNAL_TEXT=$(python3 -c "
import json,sys
lines = [json.loads(l) for l in open('$GROWTH_LOG') if l.strip()]
for l in lines[-20:]:
    print(f'[{l.get(\"signal\",\"?\")}] {l.get(\"prompt\",\"\")[:100]}')
" 2>/dev/null)

    if [ -n "$SIGNAL_TEXT" ]; then
      SUMMARY=$(echo "Analyze these failure signals from a Claude Code session and respond with ONLY valid JSON:
{\"title\": \"concise title\", \"what_happened\": \"what went wrong\", \"root_cause\": \"likely cause\", \"countermeasure\": \"suggested fix\"}

Signals (${SIGNAL_COUNT} total, showing last 20):
${SIGNAL_TEXT}" | claude --print --model opus 2>/dev/null)

      # Extract JSON and insert to growth_events
      GROWTH_JSON=$(echo "$SUMMARY" | python3 -c "
import sys,json,re
text = sys.stdin.read()
m = re.search(r'\{.*\}', text, re.DOTALL)
if m:
    try:
        c = json.loads(m.group())
        print(json.dumps({
            'event_date': '$(date +%Y-%m-%d)',
            'event_type': 'failure',
            'category': 'ops',
            'severity': 'medium',
            'phase': 8,
            'title': c.get('title','session failure')[:200],
            'what_happened': c.get('what_happened','')[:500],
            'root_cause': c.get('root_cause','')[:500],
            'countermeasure': c.get('countermeasure','')[:500],
            'tags': ['auto-detected', 'daily-batch'],
            'status': 'new'
        }))
    except: pass
" 2>/dev/null)

      if [ -n "$GROWTH_JSON" ]; then
        curl -4 -s -o /dev/null \
          -X POST "${SUPABASE_URL}/rest/v1/growth_events" \
          -H "apikey: ${SUPABASE_ANON_KEY}" \
          -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
          -H "Content-Type: application/json" \
          -H "Prefer: return=minimal" \
          -d "$GROWTH_JSON" \
          --max-time 10 2>/dev/null || true
        echo "  Summarized ${SIGNAL_COUNT} signals → growth_events"
        # Archive processed signals
        mv "$GROWTH_LOG" "${GROWTH_LOG}.$(date +%Y%m%d)" 2>/dev/null || true
      fi
    fi
  fi
else
  echo "  No pending signals"
fi

# ============================================================
# Task 3: スキル進化（skill-evolution-batch.sh に委譲）
# ============================================================
echo "--- [3/6] Skill Evolution ---"
bash "$SCRIPT_DIR/skill-evolution-batch.sh" --force 2>&1 | sed 's/^/  /'

# ============================================================
# Task 4: 部署評価（簡易版）
# ============================================================
echo "--- [4/6] Department Evaluation ---"

EVAL_LAST_FILE="$SCRIPT_DIR/.dept-eval-last-run"
EVAL_SKIP=false
if [ -f "$EVAL_LAST_FILE" ]; then
  EVAL_LAST=$(date -d "$(cat "$EVAL_LAST_FILE")" +%s 2>/dev/null || echo 0)
  EVAL_ELAPSED=$(( $(date +%s) - EVAL_LAST ))
  [ "$EVAL_ELAPSED" -lt 604800 ] && EVAL_SKIP=true  # 7日間隔
fi

if [ "$EVAL_SKIP" = "false" ]; then
  # Collect recent activity
  RECENT_ACTIVITY=$(curl -4 -s \
    "${SUPABASE_URL}/rest/v1/activity_log?select=action,dept,created_at&order=created_at.desc&limit=50" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    --max-time 10 2>/dev/null | jq -c '.' 2>/dev/null || echo "[]")

  RECENT_GROWTH=$(curl -4 -s \
    "${SUPABASE_URL}/rest/v1/growth_events?select=title,category,status&order=event_date.desc&limit=20" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    --max-time 10 2>/dev/null | jq -c '.' 2>/dev/null || echo "[]")

  EVAL_RESULT=$(echo "Evaluate the HD organization departments based on this recent data.

Activity log (last 50): ${RECENT_ACTIVITY}
Growth events (last 20): ${RECENT_GROWTH}

Rate each active department on 5 axes (A/B/C/D):
- autonomy: completed without extra instructions
- first_pass: no rework needed
- collaboration: smooth handoffs
- goal_alignment: contributes to CEO goals
- utilization: actively used

Reply ONLY valid JSON:
{\"date\": \"$(date +%Y-%m-%d)\", \"departments\": [{\"name\": \"dept-name\", \"autonomy\": \"B\", \"first_pass\": \"A\", \"collaboration\": \"B\", \"goal_alignment\": \"A\", \"utilization\": \"C\", \"note\": \"brief comment\"}], \"overall\": \"overall assessment\", \"proposals\": [\"improvement suggestion\"]}" | claude --print --model opus 2>/dev/null)

  # Save evaluation
  EVAL_DIR="/workspace/.company/hr/evaluations"
  mkdir -p "$EVAL_DIR" 2>/dev/null || true
  echo "$EVAL_RESULT" > "$EVAL_DIR/$(date +%Y-%m-%d)-auto.md"
  date -Iseconds > "$EVAL_LAST_FILE"
  echo "  Evaluation saved"
else
  EVAL_DAYS=$(( ($(date +%s) - EVAL_LAST) / 86400 ))
  echo "  Last eval ${EVAL_DAYS}d ago (< 7d). Skip."
fi

# ============================================================
# Task 5: ナレッジ昇格チェック
# ============================================================
echo "--- [5/6] Knowledge Promotion Check ---"

PROMO_CANDIDATES=$(curl -4 -s \
  "${SUPABASE_URL}/rest/v1/knowledge_base?confidence=gte.3&status=eq.active&select=id,rule,category,confidence" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  --max-time 10 2>/dev/null)

PROMO_COUNT=$(echo "$PROMO_CANDIDATES" | jq 'length' 2>/dev/null || echo 0)
if [ "$PROMO_COUNT" -gt 0 ] && [ "$PROMO_COUNT" != "null" ]; then
  echo "  Found ${PROMO_COUNT} promotion candidates (confidence >= 3)"
  echo "  Will be proposed to CEO at next /company briefing"
  # Save to temp file for /company to pick up
  echo "$PROMO_CANDIDATES" | jq '.' > "/tmp/knowledge-promotion-candidates.json" 2>/dev/null
else
  echo "  No promotion candidates"
fi

# ============================================================
# Task 6: CEO インサイト更新
# ============================================================
echo "--- [6/6] CEO Insights ---"

# Check prompt count since last insight
LAST_INSIGHT=$(curl -4 -s \
  "${SUPABASE_URL}/rest/v1/ceo_insights?select=created_at&order=created_at.desc&limit=1" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  --max-time 10 2>/dev/null | jq -r '.[0].created_at // "2000-01-01"' 2>/dev/null)

PROMPTS_SINCE=$(curl -4 -s \
  "${SUPABASE_URL}/rest/v1/prompt_log?created_at=gt.${LAST_INSIGHT}&select=id" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Prefer: count=exact" \
  -H "Range-Unit: items" \
  -H "Range: 0-0" \
  --max-time 10 2>/dev/null -w "\n%{http_code}" | head -1)

# content-range header approach
PROMPT_SINCE_COUNT=$(curl -4 -s -o /dev/null -D - \
  "${SUPABASE_URL}/rest/v1/prompt_log?created_at=gt.${LAST_INSIGHT}&select=id" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Prefer: count=exact" \
  -H "Range: 0-0" \
  --max-time 10 2>/dev/null | grep -i content-range | grep -oP '/\K[0-9]+' || echo 0)

if [ "$PROMPT_SINCE_COUNT" -ge 20 ]; then
  echo "  ${PROMPT_SINCE_COUNT} prompts since last insight — analyzing..."

  RECENT_PROMPTS=$(curl -4 -s \
    "${SUPABASE_URL}/rest/v1/prompt_log?created_at=gt.${LAST_INSIGHT}&select=prompt,tags,created_at&order=created_at.desc&limit=50" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    --max-time 10 2>/dev/null | python3 -c "
import sys,json,re
data = json.load(sys.stdin)
for d in data:
    d['prompt'] = re.sub(r'<[^>]+>','',d.get('prompt',''))[:80]
json.dump(data[:30], sys.stdout, ensure_ascii=False)
" 2>/dev/null)

  INSIGHT_RESULT=$(echo "Analyze CEO behavior patterns from these recent prompts.

Prompts: ${RECENT_PROMPTS}

Identify:
1. work_rhythm: peak hours, active days
2. pattern: recurring workflows
3. preference: tool/format preferences
4. tendency: things often forgotten or delayed

Reply ONLY valid JSON array:
[{\"category\": \"pattern|preference|tendency|work_rhythm\", \"insight\": \"description\", \"confidence\": \"high|medium|low\"}]" | claude --print --model opus 2>/dev/null)

  # Parse and insert
  INSIGHT_JSON=$(echo "$INSIGHT_RESULT" | python3 -c "
import sys,json,re
text = sys.stdin.read()
m = re.search(r'\[.*\]', text, re.DOTALL)
if m:
    try:
        items = json.loads(m.group())
        for item in items:
            row = {
                'category': item.get('category','other'),
                'insight': item.get('insight','')[:500],
                'confidence': item.get('confidence','medium'),
                'evidence': 'daily-analysis-batch prompt_log analysis'
            }
            print(json.dumps(row))
    except: pass
" 2>/dev/null)

  if [ -n "$INSIGHT_JSON" ]; then
    echo "$INSIGHT_JSON" | while IFS= read -r row; do
      curl -4 -s -o /dev/null \
        -X POST "${SUPABASE_URL}/rest/v1/ceo_insights" \
        -H "apikey: ${SUPABASE_ANON_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
        -H "Content-Type: application/json" \
        -H "Prefer: return=minimal" \
        -d "$row" \
        --max-time 5 2>/dev/null || true
    done
    echo "  Insights updated"
  fi
else
  echo "  ${PROMPT_SINCE_COUNT} prompts since last insight (< 20). Skip."
fi

# ============================================================
# 完了
# ============================================================
echo ""
echo "=== Daily Analysis Complete ==="
date -Iseconds > "$LAST_RUN_FILE"

exit 0
