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
            'category': 'process',
            'severity': 'medium',
            'phase': 'resolve',
            'title': c.get('title','session failure')[:200],
            'what_happened': c.get('what_happened','')[:500],
            'root_cause': c.get('root_cause','')[:500],
            'countermeasure': c.get('countermeasure','')[:500],
            'tags': ['auto-detected', 'daily-batch'],
            'status': 'active'
        }))
    except: pass
" 2>/dev/null)

      if [ -n "$GROWTH_JSON" ]; then
        curl -4 -s -o /dev/null \
          -X POST "${SUPABASE_URL}/rest/v1/growth_events" \
          -H "apikey: ${SUPABASE_ANON_KEY}" \
          -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
          -H "x-ingest-key: ${SUPABASE_INGEST_KEY}" \
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
  # Use Management API + file-based IO to avoid shell encoding issues with Japanese
  MGMT_API="https://api.supabase.com/v1/projects/akycymnahqypmtsfqhtr/database/query"

  curl -4 -s -X POST "$MGMT_API" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"query": "SELECT (metadata->>'\''dept'\'')::text as dept, count(*) as cnt FROM activity_log WHERE action = '\''dept_dispatch'\'' GROUP BY dept ORDER BY cnt DESC LIMIT 15"}' \
    -o /tmp/eval_depts.json --max-time 15 2>/dev/null

  curl -4 -s \
    "${SUPABASE_URL}/rest/v1/growth_events?select=title,category,status&order=event_date.desc&limit=10" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "x-ingest-key: ${SUPABASE_INGEST_KEY}" \
    -o /tmp/eval_growth.json --max-time 10 2>/dev/null

  # Build prompt in file to avoid shell variable encoding issues
  python3 -c "
import json
depts = json.load(open('/tmp/eval_depts.json'))
growth = json.load(open('/tmp/eval_growth.json'))
prompt = f'''Evaluate HD organization departments. Reply ONLY valid JSON, no explanations.

Department dispatch counts: {json.dumps(depts)}
Recent growth events: {json.dumps(growth)}

JSON format:
{{\"date\": \"$(date +%Y-%m-%d)\", \"departments\": [{{\"name\": \"dept-name\", \"autonomy\": \"B\", \"first_pass\": \"A\", \"collaboration\": \"B\", \"goal_alignment\": \"A\", \"utilization\": \"C\", \"note\": \"brief\"}}], \"overall\": \"summary\", \"proposals\": [\"suggestion\"]}}

Active departments: Explore, UX, AI-dev, sys-dev, research, intelligence, investigation, materials, pm, security, ops, marketing.
Rate each on A(excellent)/B(good)/C(needs work)/D(failing). Use dispatch counts for utilization. JSON ONLY.'''
open('/tmp/eval_prompt.txt', 'w').write(prompt)
" 2>/dev/null

  claude --print --model haiku < /tmp/eval_prompt.txt > /tmp/eval_result.txt 2>/dev/null

  # Extract JSON and save
  EVAL_DIR="/workspace/.company/hr/evaluations"
  mkdir -p "$EVAL_DIR" 2>/dev/null || true
  python3 -c "
import json, re
text = open('/tmp/eval_result.txt').read()
m = re.search(r'\{.*\}', text, re.DOTALL)
if m:
    data = json.loads(m.group())
    formatted = json.dumps(data, indent=2, ensure_ascii=False)
    with open('$EVAL_DIR/$(date +%Y-%m-%d)-auto.md', 'w') as f:
        f.write('\`\`\`json\n' + formatted + '\n\`\`\`\n')
    print('  Evaluation saved (' + str(len(data.get('departments',[]))) + ' depts)')
else:
    print('  Evaluation: no valid JSON returned')
" 2>/dev/null
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
  -H "x-ingest-key: ${SUPABASE_INGEST_KEY}" \
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
# Task 6: CEO インサイト更新（3層アーキテクチャ）
# ============================================================
echo "--- [6/6] CEO Insights (diary + prompt_log) ---"

MGMT_API="https://api.supabase.com/v1/projects/akycymnahqypmtsfqhtr/database/query"

# Helper: Management API でSQL実行（RLS回避）— 結果はファイルに保存
run_sql() {
  local OUTFILE="${2:-/tmp/sql_result.json}"
  curl -4 -s -X POST "$MGMT_API" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"query\": \"$1\"}" \
    --max-time 30 -o "$OUTFILE" 2>/dev/null
}

# Helper: run_sql + jq (for simple queries without control chars)
run_sql_jq() {
  run_sql "$1" /tmp/sql_jq.json
  cat /tmp/sql_jq.json
}

# Helper: Edge Function (completion mode, gpt-5-mini) でLLM呼び出し
# 入力ファイル: $2 (system_prompt), $3 (user_message) をファイルパスで受け取る
# sys_prompt と message はファイルから読む（bash変数展開での破壊を防止）
llm_call() {
  local SYS_PROMPT="$1"
  local MSG_FILE="$2"
  # Build request JSON safely in python
  python3 -c "
import json
sys_prompt = '''$SYS_PROMPT'''
msg = open('$MSG_FILE').read()
payload = json.dumps({
    'mode': 'completion',
    'model': 'gpt-5-mini',
    'system_prompt': sys_prompt,
    'message': msg,
    'response_format': {'type': 'json_object'}
})
open('/tmp/llm_request.json', 'w').write(payload)
" 2>/dev/null
  local RESULT=$(curl -4 -s -X POST "${SUPABASE_URL}/functions/v1/ai-agent" \
    -H "Content-Type: application/json" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -d @/tmp/llm_request.json \
    --max-time 120 2>/dev/null)
  echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('content',''))" 2>/dev/null
}

# Helper: ceo_insights に INSERT（重複チェック付き）
# このバッチは focus-you（個人プロダクト）の diary + ai_chat 由来の分析を行う。
# よって INSERT する insight の source は 'product' を既定とする。
insert_insight() {
  local CATEGORY="$1"
  local INSIGHT="$2"
  local EVIDENCE="$3"
  local CONFIDENCE="${4:-medium}"
  local SOURCE="${5:-product}"
  # Escape single quotes for SQL
  local ESC_INSIGHT=$(echo "$INSIGHT" | sed "s/'/''/g")
  local ESC_EVIDENCE=$(echo "$EVIDENCE" | sed "s/'/''/g")
  run_sql "INSERT INTO ceo_insights (category, insight, evidence, confidence, source) SELECT '${CATEGORY}', '${ESC_INSIGHT}', '${ESC_EVIDENCE}', '${CONFIDENCE}', '${SOURCE}' WHERE NOT EXISTS (SELECT 1 FROM ceo_insights WHERE category='${CATEGORY}' AND insight='${ESC_INSIGHT}');" > /dev/null
}

# ------------------------------------------------------------------
# Layer 1: エントリ下処理（未分析の日記にtopics/ai_summary付与）
# ------------------------------------------------------------------
echo "  [Layer 1] Entry preprocessing..."

run_sql "SELECT id, entry_date, body FROM diary_entries WHERE ai_summary IS NULL AND body IS NOT NULL AND length(body) > 10 ORDER BY entry_date DESC LIMIT 20;" /tmp/layer1_entries.json
UNPROCESSED_COUNT=$(python3 -c "import json; print(len(json.load(open('/tmp/layer1_entries.json'), strict=False)))" 2>/dev/null || echo 0)

if [ "$UNPROCESSED_COUNT" -gt 0 ] && [ "$UNPROCESSED_COUNT" != "null" ]; then
  echo "    ${UNPROCESSED_COUNT} unprocessed entries found"

  # Build entries text safely
  python3 -c "
import json, re
data = json.load(open('/tmp/layer1_entries.json'), strict=False)
lines = []
for d in data:
    body = re.sub(r'\s+', ' ', d.get('body', '')).strip()[:300]
    lines.append(f'[id={d[\"id\"]}] [{d[\"entry_date\"]}] {body}')
open('/tmp/layer1_msg.txt', 'w').write('\n'.join(lines))
" 2>/dev/null

  LAYER1_RESULT=$(llm_call \
    "日記エントリの下処理。各エントリについてtopics（キーワード配列）とsummary（1文要約）とnotable（特徴的ならtrue）を付与する。JSONで返す: {\"entries\": [{\"id\": N, \"topics\": [\"keyword\", ...], \"summary\": \"1文要約\", \"notable\": bool}]}" \
    /tmp/layer1_msg.txt)

  if [ -n "$LAYER1_RESULT" ]; then
    echo "$LAYER1_RESULT" | python3 -c "
import sys,json
data = json.loads(sys.stdin.read())
for e in data.get('entries', []):
    eid = e.get('id')
    topics = json.dumps(e.get('topics', []), ensure_ascii=False)
    summary = e.get('summary', '').replace(\"'\", \"''\")[:200]
    print(f\"UPDATE diary_entries SET topics='{topics}'::text[], ai_summary='{summary}' WHERE id={eid};\")
" 2>/dev/null | while IFS= read -r sql; do
      run_sql "$sql" > /dev/null
    done
    echo "    Preprocessed ${UNPROCESSED_COUNT} entries"
  fi
else
  echo "    No unprocessed entries"
fi

# ------------------------------------------------------------------
# Layer 2: 週次分析（7日ごと）
# ------------------------------------------------------------------
echo "  [Layer 2] Weekly analysis..."

LAST_WEEKLY=$(run_sql_jq "SELECT period_end FROM diary_analysis WHERE period_type='weekly' ORDER BY period_end DESC LIMIT 1;" | jq -r '.[0].period_end // "2000-01-01"' 2>/dev/null)
DAYS_SINCE_WEEKLY=$(python3 -c "
from datetime import date
last = date.fromisoformat('${LAST_WEEKLY}')
print((date.today() - last).days)
" 2>/dev/null || echo 999)

if [ "$DAYS_SINCE_WEEKLY" -ge 7 ]; then
  echo "    ${DAYS_SINCE_WEEKLY} days since last weekly — running..."

  WEEK_START=$(date -d "7 days ago" +%Y-%m-%d)
  WEEK_END=$(date +%Y-%m-%d)

  # 今週の日記（生テキスト全件）via Management API
  run_sql "SELECT entry_date, body, wbi FROM diary_entries WHERE entry_date >= '${WEEK_START}' AND body IS NOT NULL ORDER BY entry_date, created_at;" /tmp/week_diaries.json

  # 今週のprompt_log（focus-you の AIチャット由来のみ。仕事系 claude_code は除外）
  run_sql "SELECT substring(prompt from 1 for 100) as prompt, tags, created_at::date as date FROM prompt_log WHERE created_at >= '${WEEK_START}' AND source = 'ai_chat' ORDER BY created_at DESC LIMIT 50;" /tmp/week_prompts.json

  # 前回の週次分析
  PREV_WEEKLY=$(run_sql_jq "SELECT highlights, topic_summary, ai_insights FROM diary_analysis WHERE period_type='weekly' ORDER BY period_end DESC LIMIT 1;" | jq -r '.[0] // {}' 2>/dev/null)

  # 既存insights
  EXISTING_INSIGHTS=$(run_sql_jq "SELECT category, insight FROM ceo_insights ORDER BY updated_at DESC LIMIT 20;")

  # Build message file for LLM
  python3 -c "
import json, re
diaries = json.load(open('/tmp/week_diaries.json'), strict=False)
prompts = json.load(open('/tmp/week_prompts.json'), strict=False)
for p in prompts:
    p['prompt'] = re.sub(r'<[^>]+>','',p.get('prompt',''))

parts = ['## 今週の日記（生テキスト）']
for d in diaries:
    body = re.sub(r'\s+', ' ', d.get('body','')).strip()
    parts.append(f'[{d[\"entry_date\"]}] (WBI:{d.get(\"wbi\",\"?\")}) {body}')

parts.append('\n## 今週のプロンプト履歴')
parts.append(json.dumps(prompts, ensure_ascii=False))

parts.append('\n## 前回の週次分析')
parts.append('''${PREV_WEEKLY}''')

parts.append('\n## 既存のinsights（重複回避用）')
parts.append('''${EXISTING_INSIGHTS}''')

open('/tmp/weekly_msg.txt', 'w').write('\n'.join(parts))
" 2>/dev/null

  WEEK_DIARY_COUNT=$(python3 -c "import json; print(len(json.load(open('/tmp/week_diaries.json'), strict=False)))" 2>/dev/null || echo 0)

  if [ "$WEEK_DIARY_COUNT" -gt 0 ]; then
    WEEKLY_RESULT=$(llm_call \
      "あなたはユーザーの日記とプロンプト履歴を分析するアナリスト。
以下の観点で今週を分析し、JSONで返す。

分析カテゴリ（日記ベース）:
- mood_cycle: 気分の波のパターン
- trigger: 気分を上げる/下げるトリガー（正負両方）

分析カテゴリ（prompt_logベース）:
- focus: 最近集中してるテーマ
- shift: 関心の変化

ルール:
- 既に記録済みのinsightsと同じ内容は出力しない
- 具体的に書く。「忙しい」ではなく何がどう忙しいか
- 内部用語（WBI等）は使わず自然な言葉で
- 発見がないカテゴリは出力しない

JSON形式:
{
  \"summary\": \"今週の要約（3-5文。生活・気持ちの流れを自然に）\",
  \"insights\": [{\"category\": \"...\", \"insight\": \"...\", \"confidence\": \"high|medium|low\", \"source\": \"diary|prompt\"}]
}" \
      /tmp/weekly_msg.txt)

    if [ -n "$WEEKLY_RESULT" ]; then
      # diary_analysis に INSERT
      SUMMARY=$(echo "$WEEKLY_RESULT" | python3 -c "
import sys,json
d = json.loads(sys.stdin.read())
print(d.get('summary','').replace(\"'\",\"''\")[:500])
" 2>/dev/null)
      INSIGHTS_JSON=$(echo "$WEEKLY_RESULT" | python3 -c "
import sys,json
d = json.loads(sys.stdin.read())
print(json.dumps(d.get('insights',[]), ensure_ascii=False).replace(\"'\",\"''\"))
" 2>/dev/null)

      run_sql "INSERT INTO diary_analysis (period_type, period_start, period_end, entry_count, ai_insights, highlights) VALUES ('weekly', '${WEEK_START}', '${WEEK_END}', ${WEEK_DIARY_COUNT}, '${SUMMARY}', '${INSIGHTS_JSON}'::jsonb);" > /dev/null

      # ceo_insights に差分INSERT
      echo "$WEEKLY_RESULT" | python3 -c "
import sys,json
d = json.loads(sys.stdin.read())
for i in d.get('insights', []):
    cat = i.get('category','other')
    ins = i.get('insight','')
    src = i.get('source','diary')
    conf = i.get('confidence','medium')
    print(json.dumps({'cat': cat, 'ins': ins, 'src': src, 'conf': conf}))
" 2>/dev/null | while IFS= read -r row; do
        CAT=$(echo "$row" | jq -r '.cat')
        INS=$(echo "$row" | jq -r '.ins')
        SRC=$(echo "$row" | jq -r '.src')
        CONF=$(echo "$row" | jq -r '.conf')
        insert_insight "$CAT" "$INS" "source:${SRC} weekly-analysis ${WEEK_START}" "$CONF"
      done
      echo "    Weekly analysis saved (${WEEK_DIARY_COUNT} entries)"
    fi
  else
    echo "    No diary entries this week"
  fi
else
  echo "    Last weekly ${DAYS_SINCE_WEEKLY}d ago (< 7d). Skip."
fi

# ------------------------------------------------------------------
# Layer 3: 月次分析（30日ごと）
# ------------------------------------------------------------------
echo "  [Layer 3] Monthly analysis..."

LAST_MONTHLY=$(run_sql_jq "SELECT period_end FROM diary_analysis WHERE period_type='monthly' ORDER BY period_end DESC LIMIT 1;" | jq -r '.[0].period_end // "2000-01-01"' 2>/dev/null)
DAYS_SINCE_MONTHLY=$(python3 -c "
from datetime import date
last = date.fromisoformat('${LAST_MONTHLY}')
print((date.today() - last).days)
" 2>/dev/null || echo 999)

if [ "$DAYS_SINCE_MONTHLY" -ge 30 ]; then
  echo "    ${DAYS_SINCE_MONTHLY} days since last monthly — running..."

  MONTH_START=$(date -d "30 days ago" +%Y-%m-%d)
  MONTH_END=$(date +%Y-%m-%d)

  # Fetch all data to files
  run_sql "SELECT entry_date, body, wbi FROM diary_entries WHERE entry_date >= '${MONTH_START}' AND body IS NOT NULL ORDER BY entry_date, created_at;" /tmp/month_diaries.json
  run_sql "SELECT period_start, period_end, ai_insights, highlights FROM diary_analysis WHERE period_type='weekly' AND period_start >= '${MONTH_START}' ORDER BY period_start;" /tmp/month_weekly_summaries.json
  run_sql "SELECT substring(prompt from 1 for 80) as prompt, tags, created_at::date as date FROM prompt_log WHERE created_at >= '${MONTH_START}' AND source = 'ai_chat' ORDER BY created_at DESC LIMIT 100;" /tmp/month_prompts.json
  PREV_MONTHLY=$(run_sql_jq "SELECT ai_insights, highlights, topic_summary FROM diary_analysis WHERE period_type='monthly' ORDER BY period_end DESC LIMIT 1;" | jq -r '.[0] // {}' 2>/dev/null)
  EXISTING_INSIGHTS_M=$(run_sql_jq "SELECT category, insight FROM ceo_insights ORDER BY updated_at DESC LIMIT 30;")

  # Build message file
  python3 -c "
import json, re
diaries = json.load(open('/tmp/month_diaries.json'), strict=False)
prompts = json.load(open('/tmp/month_prompts.json'), strict=False)
weekly = json.load(open('/tmp/month_weekly_summaries.json'), strict=False)
for p in prompts:
    p['prompt'] = re.sub(r'<[^>]+>','',p.get('prompt',''))

parts = ['## 今月の日記（生テキスト全件）']
for d in diaries:
    body = re.sub(r'\s+', ' ', d.get('body','')).strip()
    parts.append(f'[{d[\"entry_date\"]}] (WBI:{d.get(\"wbi\",\"?\")}) {body}')

parts.append('\n## 週次要約')
parts.append(json.dumps(weekly, ensure_ascii=False))

parts.append('\n## 今月のプロンプト履歴')
parts.append(json.dumps(prompts, ensure_ascii=False))

parts.append('\n## 前回の月次分析')
parts.append('''${PREV_MONTHLY}''')

parts.append('\n## 既存のinsights（重複回避用）')
parts.append('''${EXISTING_INSIGHTS_M}''')

open('/tmp/monthly_msg.txt', 'w').write('\n'.join(parts))
open('/tmp/month_count.txt', 'w').write(str(len(diaries)))
" 2>/dev/null

  MONTH_DIARY_COUNT=$(cat /tmp/month_count.txt 2>/dev/null || echo 0)

  if [ "$MONTH_DIARY_COUNT" -gt 0 ]; then
    # Step 1: 仮説生成
    MONTHLY_STEP1=$(llm_call \
      "あなたはユーザーの日記を深く分析するアナリスト。
直近1ヶ月の日記（生テキスト全件）と週次要約、プロンプト履歴を読み、以下の観点で分析する。

分析カテゴリ（日記ベース）:
- correlation: 本人が気づいてない外部要因との相関（天気、曜日、予定の密度など）
- disconnect: 行動と感情のズレ（忙しい≠充実、暇≠不満 等）
- value: 繰り返し大事にしてること
- drift: 先月と今月の変化（気持ち、関心、行動パターン）
- fading: かつて出てたテーマが消えたもの

分析カテゴリ（prompt_logベース）:
- recurring: 繰り返し気にしてること
- blind_spot: 言及が少ない領域

ルール:
- 生の日記テキストから直接引用して根拠を示す
- 既存insightsと同じ内容は出力しない
- 数字やスコアではなく、人間的な言葉で表現する
- 意外な発見を重視する。当たり前のことは言わない
- 検証が必要な仮説があれば hypotheses に入れる

JSON形式:
{
  \"summary\": \"今月の要約（5-8文。この人の1ヶ月を物語的に）\",
  \"insights\": [{\"category\": \"...\", \"insight\": \"...\", \"evidence\": \"根拠となる日記の引用\", \"confidence\": \"high|medium|low\", \"source\": \"diary|prompt\"}],
  \"hypotheses\": [{\"hypothesis\": \"検証したい仮説\", \"query_hint\": \"過去のどんなデータを見れば検証できるか\"}]
}" \
      /tmp/monthly_msg.txt)

    if [ -n "$MONTHLY_STEP1" ]; then
      # Step 2: 仮説検証（hypotheses があれば過去データを取得して追加分析）
      HYPOTHESES=$(echo "$MONTHLY_STEP1" | python3 -c "
import sys,json
d = json.loads(sys.stdin.read())
h = d.get('hypotheses', [])
if h:
    for hyp in h[:3]:
        print(hyp.get('hypothesis',''))
" 2>/dev/null)

      STEP2_INSIGHTS=""
      if [ -n "$HYPOTHESES" ]; then
        echo "    Step 2: Verifying hypotheses..."
        OLDER_START=$(date -d "90 days ago" +%Y-%m-%d)
        run_sql "SELECT entry_date, body, wbi FROM diary_entries WHERE entry_date >= '${OLDER_START}' AND entry_date < '${MONTH_START}' AND body IS NOT NULL ORDER BY entry_date, created_at;" /tmp/older_diaries.json

        python3 -c "
import json, re
data = json.load(open('/tmp/older_diaries.json'), strict=False)
parts = ['## 検証する仮説']
parts.append(open('/tmp/hypotheses.txt').read() if __import__('os').path.exists('/tmp/hypotheses.txt') else '')
parts.append('\n## 過去2ヶ月の日記')
for d in data:
    body = re.sub(r'\s+', ' ', d.get('body','')).strip()[:200]
    parts.append(f'[{d[\"entry_date\"]}] {body}')
parts.append('\n## 今月の分析結果（参考）')
parts.append(open('/tmp/monthly_step1.txt').read() if __import__('os').path.exists('/tmp/monthly_step1.txt') else '')
open('/tmp/step2_msg.txt', 'w').write('\n'.join(parts))
open('/tmp/older_count.txt', 'w').write(str(len(data)))
" 2>/dev/null

        # Save hypotheses and step1 for python
        echo "$HYPOTHESES" > /tmp/hypotheses.txt
        echo "$MONTHLY_STEP1" > /tmp/monthly_step1.txt

        OLDER_COUNT=$(cat /tmp/older_count.txt 2>/dev/null || echo 0)

        if [ "$OLDER_COUNT" -gt 0 ]; then
          # Rebuild msg with saved files
          python3 -c "
import json, re
data = json.load(open('/tmp/older_diaries.json'), strict=False)
parts = ['## 検証する仮説']
parts.append(open('/tmp/hypotheses.txt').read())
parts.append('\n## 過去2ヶ月の日記')
for d in data:
    body = re.sub(r'\s+', ' ', d.get('body','')).strip()[:200]
    parts.append(f'[{d[\"entry_date\"]}] {body}')
parts.append('\n## 今月の分析結果（参考）')
parts.append(open('/tmp/monthly_step1.txt').read())
open('/tmp/step2_msg.txt', 'w').write('\n'.join(parts))
" 2>/dev/null

          STEP2_INSIGHTS=$(llm_call \
            "あなたは仮説検証アナリスト。先ほどの月次分析で出た仮説を、過去データを使って検証する。

検証結果をJSONで返す:
{\"verified_insights\": [{\"category\": \"...\", \"insight\": \"...\", \"evidence\": \"根拠\", \"confidence\": \"high|medium|low\", \"source\": \"diary\"}]}" \
            /tmp/step2_msg.txt)
        fi
      fi

      # diary_analysis に月次レコード INSERT
      MONTHLY_SUMMARY=$(echo "$MONTHLY_STEP1" | python3 -c "
import sys,json
d = json.loads(sys.stdin.read())
print(d.get('summary','').replace(\"'\",\"''\")[:1000])
" 2>/dev/null)
      MONTHLY_INSIGHTS_JSON=$(echo "$MONTHLY_STEP1" | python3 -c "
import sys,json
d = json.loads(sys.stdin.read())
print(json.dumps(d.get('insights',[]), ensure_ascii=False).replace(\"'\",\"''\"))
" 2>/dev/null)

      run_sql "INSERT INTO diary_analysis (period_type, period_start, period_end, entry_count, ai_insights, highlights) VALUES ('monthly', '${MONTH_START}', '${MONTH_END}', ${MONTH_DIARY_COUNT}, '${MONTHLY_SUMMARY}', '${MONTHLY_INSIGHTS_JSON}'::jsonb);" > /dev/null

      # Step 1 の insights を INSERT
      echo "$MONTHLY_STEP1" | python3 -c "
import sys,json
d = json.loads(sys.stdin.read())
for i in d.get('insights', []):
    cat = i.get('category','other')
    ins = i.get('insight','')
    src = i.get('source','diary')
    conf = i.get('confidence','medium')
    evd = i.get('evidence','')[:200]
    print(json.dumps({'cat': cat, 'ins': ins, 'src': src, 'conf': conf, 'evd': evd}))
" 2>/dev/null | while IFS= read -r row; do
        CAT=$(echo "$row" | jq -r '.cat')
        INS=$(echo "$row" | jq -r '.ins')
        SRC=$(echo "$row" | jq -r '.src')
        CONF=$(echo "$row" | jq -r '.conf')
        EVD=$(echo "$row" | jq -r '.evd')
        insert_insight "$CAT" "$INS" "source:${SRC} monthly-analysis ${MONTH_START} | ${EVD}" "$CONF"
      done

      # Step 2 の verified insights を INSERT
      if [ -n "$STEP2_INSIGHTS" ]; then
        echo "$STEP2_INSIGHTS" | python3 -c "
import sys,json
d = json.loads(sys.stdin.read())
for i in d.get('verified_insights', []):
    cat = i.get('category','other')
    ins = i.get('insight','')
    src = i.get('source','diary')
    conf = i.get('confidence','medium')
    evd = i.get('evidence','')[:200]
    print(json.dumps({'cat': cat, 'ins': ins, 'src': src, 'conf': conf, 'evd': evd}))
" 2>/dev/null | while IFS= read -r row; do
          CAT=$(echo "$row" | jq -r '.cat')
          INS=$(echo "$row" | jq -r '.ins')
          SRC=$(echo "$row" | jq -r '.src')
          CONF=$(echo "$row" | jq -r '.conf')
          EVD=$(echo "$row" | jq -r '.evd')
          insert_insight "$CAT" "$INS" "source:${SRC} monthly-step2 verified | ${EVD}" "$CONF"
        done
        echo "    Step 2: Hypotheses verified"
      fi

      echo "    Monthly analysis saved (${MONTH_DIARY_COUNT} entries)"
    fi
  else
    echo "    No diary entries this month"
  fi
else
  echo "    Last monthly ${DAYS_SINCE_MONTHLY}d ago (< 30d). Skip."
fi

# ============================================================
# Task: 昨日の成長ダイジェスト（git log + prompt_log → growth_events）
# ============================================================
echo ""
echo "[7] Growth digest (yesterday)"
if [ -x "$SCRIPT_DIR/daily-growth-digest.sh" ]; then
  bash "$SCRIPT_DIR/daily-growth-digest.sh" 2>&1 | sed 's/^/    /'
else
  echo "    daily-growth-digest.sh not found, skip"
fi

# ============================================================
# 完了
# ============================================================
echo ""
echo "=== Daily Analysis Complete ==="
date -Iseconds > "$LAST_RUN_FILE"

exit 0
