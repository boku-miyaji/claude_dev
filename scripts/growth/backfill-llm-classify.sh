#!/usr/bin/env bash
# scripts/growth/backfill-llm-classify.sh — 過去日の prompt_log を LLM 分類して growth_events にINSERT
#
# daily-analysis-batch.sh [2] のロジックを、過去の特定日に適用するスクリプト。
# - 指定日の prompt_log を全件取得
# - Claude CLI (opus) で failure/countermeasure/decision/milestone/noise に分類
# - noise 以外を growth_events に INSERT（source='llm-retroactive', PJタグ自動付与, 重複検知付き）
# - 同日に既に source='llm-retroactive' のレコードがあれば skip（idempotent）
#
# Usage:
#   backfill-llm-classify.sh <YYYY-MM-DD> [--dry-run]
#   backfill-llm-classify.sh 2026-04-15            # 1日分を処理
#   backfill-llm-classify.sh 2026-04-15 --dry-run  # LLM呼び出しまでで INSERT せず結果表示

set -uo pipefail

DATE="${1:?usage: $0 <YYYY-MM-DD> [--dry-run]}"
DRY_RUN=""
[ "${2:-}" = "--dry-run" ] && DRY_RUN=1

source ~/.claude/hooks/supabase.env 2>/dev/null || { echo "supabase.env not found"; exit 2; }
export SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_ACCESS_TOKEN SUPABASE_INGEST_KEY

SOURCE="llm-retroactive"
NEXT_DATE=$(date -d "$DATE + 1 day" +%Y-%m-%d)

# ------------- Idempotency check -------------
if [ -z "$DRY_RUN" ]; then
  EXISTING=$(curl -s "${SUPABASE_URL}/rest/v1/growth_events?event_date=eq.${DATE}&source=eq.${SOURCE}&select=id&limit=1" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "x-ingest-key: ${SUPABASE_INGEST_KEY:-}")
  if [ -n "$EXISTING" ] && [ "$EXISTING" != "[]" ]; then
    echo "[$DATE] already classified (source=$SOURCE), skip"
    exit 0
  fi
fi

# ------------- Fetch prompts for this day (Management API, bypasses RLS) -------------
PROMPTS_RES=$(curl -s -X POST "https://api.supabase.com/v1/projects/akycymnahqypmtsfqhtr/database/query" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$(python3 -c "
import json
q = '''SELECT prompt, tags, created_at FROM prompt_log
WHERE created_at >= '${DATE}T00:00:00+09:00'
  AND created_at < '${NEXT_DATE}T00:00:00+09:00'
  AND length(prompt) > 20
ORDER BY created_at ASC
LIMIT 150'''
print(json.dumps({'query': q}))
")")

PROMPT_COUNT=$(echo "$PROMPTS_RES" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo 0)

if [ "$PROMPT_COUNT" = "0" ]; then
  echo "[$DATE] no prompts, skip"
  exit 0
fi

echo "[$DATE] ${PROMPT_COUNT} prompts to classify"

# ------------- Build input for Claude CLI -------------
TMP_INPUT=$(mktemp)
TMP_INSTRUCT=$(mktemp)
TMP_PROMPTS=$(mktemp)
trap 'rm -f "$TMP_INPUT" "$TMP_INSTRUCT" "$TMP_PROMPTS"' EXIT

# Avoid env var ARG_MAX limit by writing JSON to temp file
echo "$PROMPTS_RES" > "$TMP_PROMPTS"

TMP_PROMPTS="$TMP_PROMPTS" DATE="$DATE" python3 <<'PYEOF' > "$TMP_INPUT"
import json, os, re
def clean(s):
    if not s:
        return ''
    return re.sub(r'\x00', '', str(s))  # strip null bytes PostgreSQL cannot store
with open(os.environ['TMP_PROMPTS'], encoding='utf-8') as f:
    data = json.load(f)
for i, r in enumerate(data, 1):
    p = re.sub(r'<[^>]+>', '', clean(r.get('prompt')))
    p = re.sub(r'\s+', ' ', p).strip()[:250]
    if p:
        t = (r.get('created_at') or '')[:16]
        print(f'[{i}] ({t}) {p}')
PYEOF

cat > "$TMP_INSTRUCT" <<'INSTRUCT'
あなたは Claude Code の成長記録アナリスト。以下のユーザープロンプト群（1日分）を分析し、
growth_events に記録すべきイベント（意味のある意思決定・失敗・対策・達成）を抽出する。

会話フローの中で1つの意思決定や失敗は複数プロンプトに跨るため、関連するものは1件にまとめる。
単純な質問・確認・雑談・作業依頼のみ（技術的な決定を伴わない）は記録しない。

event_type の基準:
- failure:        バグ・障害・ミスが起きた事実の報告（「動かない」「おかしい」「落ちた」「間違ってる」「それじゃない」等）
- countermeasure: 失敗を受けた対策決定（「〜しないように」「〜を直した」「今後は〜する」等）
- decision:       前向きな意思決定（「〜で行く」「〜にする」「〜を採用」「方針を〜に」等）
- milestone:      達成・完了（「〜完了」「リリース」「動いた」「できた」等）

severity: critical(本番影響) / high(動作阻害) / medium(改善必要) / low(些細)
category: security / architecture / devops / automation / tooling / organization / process / quality / communication

tags ルール（超重要）:
- PJタグを必ず1つ: claude-dev(PJ横断) / focus-you(ダッシュボード) / polaris-circuit(回路PJ) / rikyu(りそな案件) / agent-harness(Claude Code harness)
- 判定: 「このPJが消滅したら消える知識か?」YES→PJ固有 / NO→claude-dev
- 領域タグ（0〜N個・任意）: supabase, edge-function, hook, llm-prompt, cost, ui, frontend, backend, auth, ci-cd, testing, documentation, migration, security, operations

出力は JSON 配列のみ（最大5件。該当なしなら [] を返す）:
[
  {
    "event_type": "failure|countermeasure|decision|milestone",
    "title": "簡潔なタイトル（40文字以内）",
    "what_happened": "何が起きたか（100-200字）",
    "root_cause": "原因 または null",
    "countermeasure": "対策 または null",
    "result": "結果 または null",
    "severity": "critical|high|medium|low",
    "category": "process|architecture|quality|...",
    "tags": ["claude-dev", "..."]
  }
]

他の文字（説明・コードフェンス等）は一切含めない。JSON 配列のみ。
INSTRUCT

# ------------- Call Claude CLI -------------
RESP=$(cat "$TMP_INPUT" | claude --print --model opus --append-system-prompt "$(cat "$TMP_INSTRUCT")" 2>/dev/null)

if [ -z "$RESP" ]; then
  echo "[$DATE] empty LLM response"
  exit 1
fi

EVENTS_JSON=$(echo "$RESP" | python3 -c "
import sys, re, json
t = sys.stdin.read()
m = re.search(r'\[[\s\S]*\]', t)
if m:
    try:
        parsed = json.loads(m.group(0))
        if isinstance(parsed, list):
            print(json.dumps(parsed, ensure_ascii=False))
            sys.exit(0)
    except Exception:
        pass
print('[]')
" 2>/dev/null)

EVENT_COUNT=$(echo "$EVENTS_JSON" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo 0)

if [ "$EVENT_COUNT" = "0" ]; then
  echo "[$DATE] no growth events extracted"
  exit 0
fi

echo "[$DATE] ${EVENT_COUNT} events extracted"

# ------------- Build payload -------------
PAYLOAD=$(echo "$EVENTS_JSON" | python3 -c "
import sys, json, re
events = json.load(sys.stdin)
PROJ = {'claude-dev','focus-you','polaris-circuit','rikyu','agent-harness'}
def clean(s):
    if s is None: return None
    return re.sub(r'\x00', '', str(s))
out = []
for e in events:
    tags = e.get('tags') or []
    if not any(t in PROJ for t in tags):
        tags = ['claude-dev'] + tags
    for m in ('llm-retroactive', 'llm-classified'):
        if m not in tags:
            tags.append(m)
    out.append({
        'event_date': '$DATE',
        'event_type': e.get('event_type', 'decision'),
        'category': e.get('category', 'process'),
        'severity': e.get('severity', 'medium'),
        'title': clean((e.get('title') or 'untitled')[:120]),
        'what_happened': clean(e.get('what_happened') or ''),
        'root_cause': clean(e.get('root_cause')),
        'countermeasure': clean(e.get('countermeasure')),
        'result': clean(e.get('result')),
        'tags': tags,
        'source': 'llm-retroactive',
        'status': 'active',
    })
print(json.dumps(out, ensure_ascii=False))
" 2>/dev/null)

if [ -n "$DRY_RUN" ]; then
  echo "--- DRY RUN (no INSERT) ---"
  echo "$PAYLOAD" | python3 -m json.tool
  exit 0
fi

# ------------- Insert each event with dedup -------------
INSERTED=0
SKIPPED=0
echo "$PAYLOAD" | python3 -c "
import sys, json
events = json.load(sys.stdin)
for e in events:
    print(json.dumps(e, ensure_ascii=False))
" | while IFS= read -r row; do
  TITLE=$(echo "$row" | python3 -c "import sys,json; print(json.load(sys.stdin)['title'])")
  T_ENC=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$TITLE")
  SINCE=$(date -d "$DATE - 7 days" +%Y-%m-%d)
  UNTIL=$(date -d "$DATE + 7 days" +%Y-%m-%d)
  DUP=$(curl -s "${SUPABASE_URL}/rest/v1/growth_events?title=eq.${T_ENC}&event_date=gte.${SINCE}&event_date=lte.${UNTIL}&select=id" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "x-ingest-key: ${SUPABASE_INGEST_KEY:-}" --max-time 5 2>/dev/null)
  if [ -n "$DUP" ] && [ "$DUP" != "[]" ]; then
    echo "  skip (dup): $TITLE"
    continue
  fi
  RES=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/growth_events" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "x-ingest-key: ${SUPABASE_INGEST_KEY:-}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d "$row" --max-time 10 2>&1)
  if [ -z "$RES" ] || echo "$RES" | grep -q '"code"'; then
    if [ -n "$RES" ]; then
      echo "  INSERT warn: $RES"
    fi
  fi
  echo "  + $TITLE"
done

# ------------- Insert a retroactive marker so idempotency kicks in next run -------------
MARKER_PAYLOAD=$(python3 -c "
import json
print(json.dumps({
  'event_date': '$DATE',
  'event_type': 'milestone',
  'category': 'process',
  'severity': 'low',
  'title': 'llm-retroactive batch marker ($DATE)',
  'what_happened': 'Retroactive LLM classification completed for $DATE.',
  'status': 'resolved',
  'source': 'llm-retroactive',
  'tags': ['claude-dev', 'batch-marker']
}))
")

curl -s -o /dev/null -X POST "${SUPABASE_URL}/rest/v1/growth_events" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "x-ingest-key: ${SUPABASE_INGEST_KEY:-}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d "$MARKER_PAYLOAD" --max-time 10 2>/dev/null || true

echo "[$DATE] done"
