#!/usr/bin/env bash
# scripts/growth/backfill-project-tags.sh — 既存 growth_events に PJ タグを遡及付与
#
# rule-based 分類:
#   focus-you       … narrator/diary/growth/roots/感情分析/WBI/今日のコメント/silence-first
#   polaris-circuit … 回路/circuit/polaris/部品/データシート
#   rikyu           … rikyu/りそな/りきゅう/コンサル
#   agent-harness   … harness/エージェント設計/Claude Code/hook/freshness/subagent
#   claude-dev      … 上記以外で Supabase/CLAUDE.md/部署/運営/rules/ など（default）
#
# 判定できない場合は 'claude-dev' を default として付与する。
# --dry-run オプションで UPDATE せず判定結果を表示。

set -uo pipefail

source ~/.claude/hooks/supabase.env 2>/dev/null || { echo "supabase.env not found"; exit 2; }
# Export for Python subprocesses
export SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_ACCESS_TOKEN SUPABASE_INGEST_KEY

DRY_RUN=""
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

echo "[backfill] fetching unclassified records..."

# Fetch records that have no PJ tag yet
RECORDS=$(curl -s -X POST "https://api.supabase.com/v1/projects/akycymnahqypmtsfqhtr/database/query" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT id, title, what_happened, tags, category FROM growth_events WHERE NOT (tags && ARRAY['"'"'claude-dev'"'"','"'"'focus-you'"'"','"'"'polaris-circuit'"'"','"'"'rikyu'"'"','"'"'agent-harness'"'"']) ORDER BY event_date ASC"}')

COUNT=$(echo "$RECORDS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
echo "[backfill] $COUNT records to classify"

[ "$COUNT" = "0" ] && { echo "[backfill] nothing to do"; exit 0; }

# Run classification via Python
RECORDS_FILE=$(mktemp)
UPDATES_FILE=$(mktemp)
echo "$RECORDS" > "$RECORDS_FILE"
trap 'rm -f "$RECORDS_FILE" "$UPDATES_FILE"' EXIT

RECORDS_FILE="$RECORDS_FILE" UPDATES_FILE="$UPDATES_FILE" python3 <<'PYEOF'
import json, os, re
from collections import Counter

with open(os.environ['RECORDS_FILE'], encoding='utf-8') as f:
    records = json.load(f)

# Classification rules (checked in order)
RULES = [
    # polaris-circuit: 最も特異なので最優先
    ('polaris-circuit', re.compile(r'polaris|回路|circuit|データシート|部品|電子回路', re.IGNORECASE)),
    # rikyu: 社名固有
    ('rikyu', re.compile(r'rikyu|りそな|りきゅう', re.IGNORECASE)),
    # focus-you: UI / プロダクト機能系
    ('focus-you', re.compile(
        r'focus-you|narrator|diary|日記|感情分析|emotion|WBI|wbi|roots|今日のコメント|silence-first|'
        r'ダッシュボード.*(UI|UX|表示|画面)|dashboard.*(ui|ux)|growth(\s|$)|成長記録.*UI|'
        r'AIチャット|ai_chat|PERMA|アドベンチャー', re.IGNORECASE)),
    # agent-harness: Claude Code / subagent / harness / hook 設計
    ('agent-harness', re.compile(
        r'harness|subagent|claude\s*code|ハーネス|エージェント設計|agent設計|'
        r'freshness[-_]policy|Magentic|部署.*agent|/company|company.*skill|'
        r'(UserPromptSubmit|PostToolUse|SessionStart|Stop)\s*hook|hook.*連鎖|hook.*loop|hook自己', re.IGNORECASE)),
]

def classify(r):
    text = ' '.join(filter(None, [
        r.get('title') or '',
        r.get('what_happened') or '',
        ' '.join(r.get('tags') or []),
        r.get('category') or '',
    ]))
    for tag, pat in RULES:
        if pat.search(text):
            return tag
    # default
    return 'claude-dev'

updates = []
stats = Counter()
for r in records:
    pj = classify(r)
    stats[pj] += 1
    # Append to tags (dedup)
    existing = r.get('tags') or []
    if pj in existing:
        continue
    new_tags = list(existing) + [pj]
    updates.append({'id': r['id'], 'tags': new_tags, 'pj': pj, 'title': r['title']})

with open(os.environ['UPDATES_FILE'], 'w') as f:
    json.dump(updates, f, ensure_ascii=False)

print(f"[classify] {dict(stats)}")
print(f"[classify] {len(updates)} records need tag update")
PYEOF

# If dry-run, show first 10 and exit
if [ -n "$DRY_RUN" ]; then
  echo "[backfill] DRY RUN — first 10 planned updates:"
  python3 -c "
import json
ups = json.load(open('$UPDATES_FILE'))
for u in ups[:10]:
    print(f\"  [{u['pj']}] {u['title']}\")
print(f\"... total {len(ups)} updates\")
"
  exit 0
fi

# Apply updates via REST API PATCH (one-by-one, safer)
echo "[backfill] applying updates via REST PATCH..."

UPDATES_FILE="$UPDATES_FILE" python3 <<'PYEOF'
import json, os, urllib.request

updates = json.load(open(os.environ['UPDATES_FILE']))
SUPABASE_URL = os.environ['SUPABASE_URL']
ANON = os.environ['SUPABASE_ANON_KEY']
INGEST = os.environ.get('SUPABASE_INGEST_KEY', '')

total_done = 0
total_failed = 0
for i, u in enumerate(updates, 1):
    url = f"{SUPABASE_URL}/rest/v1/growth_events?id=eq.{u['id']}"
    body = json.dumps({'tags': u['tags']}).encode('utf-8')
    req = urllib.request.Request(
        url, data=body, method='PATCH',
        headers={
            'apikey': ANON,
            'Authorization': f'Bearer {ANON}',
            'x-ingest-key': INGEST,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            resp.read()
        total_done += 1
        if i % 20 == 0:
            print(f"  progress {i}/{len(updates)}")
    except Exception as e:
        total_failed += 1
        if total_failed <= 5:
            print(f"  [{u['id']}] FAILED: {e}")

print(f"[backfill] done: {total_done}/{len(updates)} updated, {total_failed} failed")
PYEOF
