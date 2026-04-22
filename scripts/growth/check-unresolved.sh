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

# ------------- Severity-based thresholds -------------
# critical / high → 2日超で警告
# medium          → 5日超
# low / null      → 10日超
TWO_AGO=$(date -d "2 days ago" +%Y-%m-%d)
FIVE_AGO=$(date -d "5 days ago" +%Y-%m-%d)
TEN_AGO=$(date -d "10 days ago" +%Y-%m-%d)

# ------------- Query 1: stale active failures (severity-based) -------------
QUERY_1="
SELECT id, event_date, title, tags, severity,
  (CURRENT_DATE - event_date) AS age_days
FROM growth_events
WHERE event_type = 'failure'
  AND status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM growth_events c
    WHERE c.parent_id = growth_events.id
      AND c.event_type = 'countermeasure'
  )
  AND (
    (severity IN ('critical','high') AND event_date < '$TWO_AGO')
    OR (severity = 'medium' AND event_date < '$FIVE_AGO')
    OR ((severity = 'low' OR severity IS NULL) AND event_date < '$TEN_AGO')
  )
ORDER BY
  CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
  event_date ASC
LIMIT 50
"

# ------------- Query 2: failures without any countermeasure (any age, limited) -------------
QUERY_2="
SELECT f.id, f.event_date, f.title, f.tags, f.severity,
  (CURRENT_DATE - f.event_date) AS age_days
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

# ------------- Query 3: countermeasures without milestone (severity-based) -------------
QUERY_3="
SELECT c.id, c.event_date, c.title, c.tags, c.severity,
  (CURRENT_DATE - c.event_date) AS age_days
FROM growth_events c
WHERE c.event_type = 'countermeasure'
  AND c.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM growth_events m
    WHERE m.parent_id = c.id AND m.event_type = 'milestone'
  )
  AND c.result IS NULL
  AND (
    (c.severity IN ('critical','high') AND c.event_date < '$TWO_AGO')
    OR (c.severity = 'medium' AND c.event_date < '$FIVE_AGO')
    OR ((c.severity = 'low' OR c.severity IS NULL) AND c.event_date < '$TEN_AGO')
  )
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
    age = r.get('age_days', '?')
    marker = '🔥' if sev in ('critical','high') else ('⚠' if sev == 'medium' else '·')
    print(f\"  {marker} [{r.get('event_date')} / {age}d ago] [{proj}/{sev}] {r.get('title','')}\")
    print(f\"     id: {r.get('id')}\")
"
}

print_section "対策未決 failure（high: 2日超 / medium: 5日超 / low: 10日超）" "$R1"
print_section "countermeasure が紐づかない failure（全期間、参考）" "$R2"
print_section "結果未記録 countermeasure（同じ severity 閾値）" "$R3"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "対策を記録するには:"
echo "  bash scripts/growth/record.sh countermeasure <project_tag> \"<title>\" \\"
echo "    --parent-id=<failure_id> --what-happened=\"...\""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
