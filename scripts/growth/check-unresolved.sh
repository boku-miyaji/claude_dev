#!/usr/bin/env bash
# scripts/growth/check-unresolved.sh — 未解決 failure の検知
#
# 以下を検出して表示する:
#   1. failure で status='active' のまま 14日超過（対策が決まっていない）
#   2. failure に countermeasure が紐づいていない（parent_id で繋がっていない）
#   3. countermeasure に milestone（結果）が紐づいていない
#
# Output:
#   - stdout: 人間向けサマリ
#   - stderr: なし
#   - exit 0: 常に
#
# Usage:
#   check-unresolved.sh [--json]

set -uo pipefail

source ~/.claude/hooks/supabase.env 2>/dev/null || {
  echo "Error: supabase.env not found" >&2; exit 2
}

JSON_OUT=""
[ "${1:-}" = "--json" ] && JSON_OUT=1

# ------------- Query 1: active failures older than 14 days -------------
FOURTEEN_AGO=$(date -d "14 days ago" +%Y-%m-%d)

QUERY_1="
SELECT id, event_date, title, tags, severity
FROM growth_events
WHERE event_type = 'failure'
  AND status = 'active'
  AND event_date < '$FOURTEEN_AGO'
  AND NOT EXISTS (
    SELECT 1 FROM growth_events c
    WHERE c.parent_id = growth_events.id
      AND c.event_type = 'countermeasure'
  )
ORDER BY event_date ASC
LIMIT 50
"

# ------------- Query 2: failures without any countermeasure (any age) -------------
QUERY_2="
SELECT f.id, f.event_date, f.title, f.tags, f.severity,
  EXISTS(SELECT 1 FROM growth_events c WHERE c.parent_id = f.id AND c.event_type = 'countermeasure') as has_countermeasure
FROM growth_events f
WHERE f.event_type = 'failure'
  AND f.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM growth_events c
    WHERE c.parent_id = f.id AND c.event_type = 'countermeasure'
  )
ORDER BY f.event_date DESC
LIMIT 30
"

# ------------- Query 3: countermeasures without milestone (result not recorded) -------------
QUERY_3="
SELECT c.id, c.event_date, c.title, c.tags
FROM growth_events c
WHERE c.event_type = 'countermeasure'
  AND c.status = 'active'
  AND c.event_date < '$FOURTEEN_AGO'
  AND NOT EXISTS (
    SELECT 1 FROM growth_events m
    WHERE m.parent_id = c.id AND m.event_type = 'milestone'
  )
  AND c.result IS NULL
ORDER BY c.event_date ASC
LIMIT 30
"

run_query() {
  local q="$1"
  curl -s -X POST "https://api.supabase.com/v1/projects/akycymnahqypmtsfqhtr/database/query" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$(python3 -c "import json,sys; print(json.dumps({'query': sys.stdin.read()}))" <<< "$q")"
}

R1=$(run_query "$QUERY_1")
R2=$(run_query "$QUERY_2")
R3=$(run_query "$QUERY_3")

if [ -n "$JSON_OUT" ]; then
  python3 <<PYEOF
import json
print(json.dumps({
  'stale_active_failures': json.loads('''$R1'''),
  'failures_without_countermeasure': json.loads('''$R2'''),
  'countermeasures_without_milestone': json.loads('''$R3''')
}, ensure_ascii=False, indent=2))
PYEOF
  exit 0
fi

# ------------- Human-readable output -------------
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " growth_events — 未解決チェック"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

print_section() {
  local title="$1"; local json="$2"
  local count
  count=$(echo "$json" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo 0)
  echo ""
  echo "■ $title ($count 件)"
  if [ "$count" = "0" ]; then
    echo "  （なし）"
    return
  fi
  echo "$json" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for r in data:
    tags = r.get('tags') or []
    proj = next((t for t in tags if t in ('claude-dev','focus-you','polaris-circuit','rikyu','agent-harness')), '-')
    sev = r.get('severity') or '-'
    print(f\"  [{r.get('event_date')}] [{proj}/{sev}] {r.get('title','')}\")
    print(f\"    id: {r.get('id')}\")
"
}

print_section "14日超・対策未決の failure" "$R1"
print_section "countermeasure が紐づかない failure（全期間）" "$R2"
print_section "14日超・結果未記録の countermeasure" "$R3"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "対策を記録するには:"
echo "  bash scripts/growth/record.sh countermeasure <project_tag> \"<title>\" \\"
echo "    --parent-id=<failure_id> --what-happened=\"...\""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
