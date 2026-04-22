#!/bin/bash
# generate-growth-for-day.sh <YYYY-MM-DD> <source>
#
# 1日分の git log + prompt_log を Claude CLI (opus) で解析し、
# growth_events に INSERT する。
#
# Usage:
#   ./generate-growth-for-day.sh 2026-04-12 daily-digest
#   ./generate-growth-for-day.sh 2025-07-15 backfill
#
# Arguments:
#   $1 = date (YYYY-MM-DD)
#   $2 = source tag (daily-digest | backfill)
#
# Returns:
#   0 = success (0-N events inserted)
#   1 = error

set -uo pipefail

DATE="${1:-}"
SOURCE="${2:-manual}"
[ -z "$DATE" ] && { echo "Usage: $0 <YYYY-MM-DD> <source>"; exit 1; }

# Load Supabase env
source ~/.claude/hooks/supabase.env 2>/dev/null || { echo "supabase.env not found"; exit 1; }

REPO_DIR="${REPO_DIR:-/workspace}"
cd "$REPO_DIR" || exit 1

NEXT_DATE=$(date -d "$DATE + 1 day" +%Y-%m-%d)

# ============================================================
# 1. Idempotency: skip if events already exist for this day+source
# ============================================================
EXISTING=$(curl -s "${SUPABASE_URL}/rest/v1/growth_events?event_date=eq.${DATE}&source=eq.${SOURCE}&select=id" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "x-ingest-key: ${SUPABASE_INGEST_KEY:-}")
if [ "$EXISTING" != "[]" ] && [ -n "$EXISTING" ]; then
  echo "[$DATE] already has ${SOURCE} events, skip"
  exit 0
fi

# ============================================================
# 2. Collect git activity for this day
# ============================================================
COMMITS=$(git log --since="$DATE 00:00" --until="$DATE 23:59:59" \
  --format="%h|%s|%an" --no-merges 2>/dev/null)
if [ -z "$COMMITS" ]; then
  COMMIT_COUNT=0
else
  COMMIT_COUNT=$(printf '%s\n' "$COMMITS" | grep -c '^' | tr -d '[:space:]')
fi

# Diff stats (files changed summary, not full diff to save tokens)
DIFF_STAT=""
if [ "$COMMIT_COUNT" -gt 0 ]; then
  DIFF_STAT=$(git log --since="$DATE 00:00" --until="$DATE 23:59:59" \
    --shortstat --format="" --no-merges 2>/dev/null | \
    grep -E "files? changed" | head -20)
fi

# Changed file paths (top 30)
CHANGED_FILES=""
if [ "$COMMIT_COUNT" -gt 0 ]; then
  CHANGED_FILES=$(git log --since="$DATE 00:00" --until="$DATE 23:59:59" \
    --name-only --format="" --no-merges 2>/dev/null | \
    sort -u | grep -v "^$" | head -30)
fi

# ============================================================
# 3. Collect prompt_log samples for this day (up to 15)
# ============================================================
PROMPTS_JSON=$(curl -s "${SUPABASE_URL}/rest/v1/prompt_log?created_at=gte.${DATE}T00:00:00&created_at=lt.${NEXT_DATE}T00:00:00&select=prompt&order=created_at.asc&limit=15" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" 2>/dev/null)

# Extract plain prompts (no jq dependency, use python)
PROMPTS=$(echo "$PROMPTS_JSON" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for i, row in enumerate(data, 1):
        p = (row.get('prompt') or '').replace('\n', ' ')[:300]
        if p.strip():
            print(f'{i}. {p}')
except Exception:
    pass
" 2>/dev/null)

if [ -z "$PROMPTS" ]; then
  PROMPT_COUNT=0
else
  PROMPT_COUNT=$(printf '%s\n' "$PROMPTS" | grep -c '^' | tr -d '[:space:]')
fi

# ============================================================
# 4. Skip empty days
# ============================================================
if [ "$COMMIT_COUNT" -eq 0 ] && [ "$PROMPT_COUNT" -eq 0 ]; then
  echo "[$DATE] no activity, skip"
  exit 0
fi

echo "[$DATE] ${COMMIT_COUNT} commits, ${PROMPT_COUNT} prompts — generating..."

# ============================================================
# 5. Build Claude CLI prompt
# ============================================================
INPUT=$(cat <<EOF
あなたは claude_dev プロジェクトの成長記録アナリストです。
以下の1日分のデータから「記録に値する成長イベント」を構造化して JSON 配列で返してください。

重要:
- 雑多な bug fix や typo 修正は記録不要
- アーキテクチャ変更・新機能・リファクタリング・重要な意思決定・失敗からの学び・ワークフロー改善など意味のあるものだけ
- 1日に 0〜3 件が目安。無理に作らない
- 何もなければ空配列 []
- 簡潔に日本語で

出力 schema（JSON 配列のみ、他の文字を含めない）:
[
  {
    "event_type": "failure" | "countermeasure" | "decision" | "milestone",
    "category": "security" | "architecture" | "devops" | "automation" | "tooling" | "organization" | "process" | "quality" | "communication",
    "severity": "critical" | "high" | "medium" | "low",
    "title": "簡潔なタイトル（40文字以内）",
    "what_happened": "何が起きたか（100-200字）",
    "root_cause": "なぜ起きたか / きっかけ（または null）",
    "countermeasure": "どう対処したか（または null）",
    "result": "結果（または null）",
    "related_commits": ["短いhash", "..."],
    "tags": ["<PJタグ必須1つ>", "<領域タグ0〜N個>"]
  }
]

event_type の使い分け:
- failure         = 失敗・障害・ミス（事実）
- countermeasure  = 失敗を受けた対策決定（parent_id で failure に紐づけが理想）
- decision        = 障害を伴わない前向きな意思決定（技術選定・方針）
- milestone       = 達成・到達・リリース

tags ルール（重要）:
- **PJタグを必ず1つ**付ける。選択肢（このうち1つを先頭に）:
    claude-dev       (PJ横断・運営基盤・Hook)
    focus-you        (個人ダッシュボード)
    polaris-circuit  (回路図PJ)
    rikyu            (りそなコンサル案件)
    agent-harness    (Claude Code / エージェント harness 設計自体)
- 判定基準: 「このPJが消滅したら消える知識か？」YES → PJ固有タグ / NO → claude-dev or agent-harness
- 領域タグ（任意）: supabase, edge-function, rls, hook, llm-prompt, cost, ui, frontend, backend, auth, ci-cd, testing, documentation, migration, security, operations
- `auto-detected` `daily-batch` は自動付与されるので書かない

=== 日付: ${DATE} ===

=== コミット (${COMMIT_COUNT}件) ===
${COMMITS}

=== 変更統計 ===
${DIFF_STAT}

=== 変更ファイル (top 30) ===
${CHANGED_FILES}

=== ユーザープロンプト抜粋 (${PROMPT_COUNT}件) ===
${PROMPTS}

JSON 配列のみを出力:
EOF
)

# ============================================================
# 6. Call Claude CLI
# ============================================================
if ! command -v claude &>/dev/null; then
  echo "[$DATE] claude CLI not found, skip"
  exit 1
fi

RESPONSE=$(echo "$INPUT" | claude --print --model opus 2>/dev/null)
if [ -z "$RESPONSE" ]; then
  echo "[$DATE] empty response from Claude"
  exit 1
fi

# Extract JSON array (strip code fences if any)
JSON=$(echo "$RESPONSE" | python3 -c "
import sys, re, json
text = sys.stdin.read()
# Find first [...] block, handling code fences
m = re.search(r'\[[\s\S]*\]', text)
if m:
    try:
        parsed = json.loads(m.group(0))
        print(json.dumps(parsed, ensure_ascii=False))
    except json.JSONDecodeError:
        print('[]')
else:
    print('[]')
" 2>/dev/null)

EVENT_COUNT=$(echo "$JSON" | python3 -c "
import sys, json
try:
    print(len(json.load(sys.stdin)))
except Exception:
    print(0)
")

if [ "$EVENT_COUNT" = "0" ]; then
  echo "[$DATE] no events generated (0)"
  exit 0
fi

# ============================================================
# 7. INSERT each event with x-ingest-key
# ============================================================
INGEST_KEY="${SUPABASE_INGEST_KEY:-}"
if [ -z "$INGEST_KEY" ]; then
  echo "[$DATE] SUPABASE_INGEST_KEY missing, using anon"
fi

PAYLOAD=$(echo "$JSON" | python3 -c "
import sys, json, re
events = json.load(sys.stdin)
STANDARD_PROJECTS = {'claude-dev','focus-you','polaris-circuit','rikyu','agent-harness'}
def clean(s):
    if s is None: return None
    return re.sub(r'\x00', '', str(s))
out = []
for e in events:
    tags = e.get('tags') or []
    # Ensure a PJ tag exists; default to 'claude-dev' if LLM forgot
    if not any(t in STANDARD_PROJECTS for t in tags):
        tags = ['claude-dev'] + tags
    # Append source markers
    source_marker = 'daily-digest' if '${SOURCE}' == 'daily-digest' else 'backfill'
    if 'auto-detected' not in tags: tags.append('auto-detected')
    if source_marker not in tags: tags.append(source_marker)
    out.append({
        'event_date': '${DATE}',
        'event_type': e.get('event_type', 'milestone'),
        'category': e.get('category', 'process'),
        'severity': e.get('severity', 'medium'),
        'title': clean((e.get('title') or '')[:120]),
        'what_happened': clean(e.get('what_happened') or ''),
        'root_cause': clean(e.get('root_cause')),
        'countermeasure': clean(e.get('countermeasure')),
        'result': clean(e.get('result')),
        'related_commits': e.get('related_commits') or [],
        'tags': tags,
        'source': '${SOURCE}',
        'status': 'active',
    })
print(json.dumps(out, ensure_ascii=False))
")

INSERT_RES=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/growth_events" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "x-ingest-key: ${INGEST_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d "$PAYLOAD" 2>&1)

if [ -z "$INSERT_RES" ] || [[ "$INSERT_RES" == *"error"* ]] && [[ "$INSERT_RES" != *"{}"* ]]; then
  echo "[$DATE] ✓ inserted $EVENT_COUNT events"
else
  echo "[$DATE] insert issue: $INSERT_RES"
fi
