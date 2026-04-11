#!/bin/bash
# Hook: UserPromptSubmit (matcher: ^/company) → 稼働リズム示唆を更新
#
# prompt_log.created_at から時間帯・曜日分布を集計し、
# ceo_insights の work_rhythm カテゴリを最新データで上書きする。
# グラフ描画はフロントエンド(legacy.ts)が担当、ここは示唆テキストのみ。

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/supabase-check.sh" 2>/dev/null || true
[ "${SUPABASE_AVAILABLE:-false}" = "true" ] || exit 0

MGMT_API="https://api.supabase.com/v1/projects/akycymnahqypmtsfqhtr/database/query"

run_sql_file() {
  local SQL_FILE="$1"
  curl -4 -s -X POST "$MGMT_API" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$(python3 -c "import json; print(json.dumps({'query': open('$SQL_FILE').read()}))")" \
    --max-time 15 2>/dev/null
}

# --- 集計クエリ（直近30日、JST） ---
cat > /tmp/work_rhythm_query.sql << 'EOSQL'
SELECT json_build_object(
  'total', count(*),
  'hourly', (SELECT json_agg(row_to_json(h)) FROM (
    SELECT extract(hour from created_at at time zone 'Asia/Tokyo')::int as hour,
           count(*) as cnt
    FROM prompt_log
    WHERE created_at >= now() - interval '30 days'
    GROUP BY 1 ORDER BY 1
  ) h),
  'daily', (SELECT json_agg(row_to_json(d)) FROM (
    SELECT extract(dow from created_at at time zone 'Asia/Tokyo')::int as dow,
           count(*) as cnt
    FROM prompt_log
    WHERE created_at >= now() - interval '30 days'
    GROUP BY 1 ORDER BY 1
  ) d),
  'late_night', (SELECT count(*) FROM prompt_log
    WHERE created_at >= now() - interval '30 days'
    AND extract(hour from created_at at time zone 'Asia/Tokyo') IN (22,23,0,1,2,3,4,5)),
  'weekend', (SELECT count(*) FROM prompt_log
    WHERE created_at >= now() - interval '30 days'
    AND extract(dow from created_at at time zone 'Asia/Tokyo') IN (0,6))
) as stats
FROM prompt_log
WHERE created_at >= now() - interval '30 days';
EOSQL

STATS=$(run_sql_file /tmp/work_rhythm_query.sql)

# パースして示唆を生成
INSIGHT=$(echo "$STATS" | python3 -c "
import json, sys

try:
    data = json.load(sys.stdin)
    if not data or len(data) == 0:
        sys.exit(0)
    stats = data[0]['stats']
    if not stats or stats.get('total', 0) < 10:
        sys.exit(0)
except:
    sys.exit(0)

total = stats['total']
hourly = {h['hour']: h['cnt'] for h in (stats.get('hourly') or [])}
daily = {d['dow']: d['cnt'] for d in (stats.get('daily') or [])}
late_night = stats.get('late_night', 0)
weekend = stats.get('weekend', 0)

dow_labels = ['日','月','火','水','木','金','土']

# ピーク時間帯
peak_hour = max(hourly, key=hourly.get) if hourly else 0

# 最活発曜日
peak_dow = max(daily, key=daily.get) if daily else 1
peak_dow_label = dow_labels[peak_dow]

# 深夜率・週末率
late_pct = round(late_night / total * 100) if total > 0 else 0
weekend_pct = round(weekend / total * 100) if total > 0 else 0

# 最も少ない平日
weekday_counts = {d: daily.get(d, 0) for d in range(1, 6)}
min_weekday = min(weekday_counts, key=weekday_counts.get)
min_weekday_label = dow_labels[min_weekday]
min_weekday_count = weekday_counts[min_weekday]

# 集中時間帯（上位3）
top3_hours = sorted(hourly.items(), key=lambda x: -x[1])[:3]
top3_str = ', '.join(f'{int(h)}時({c}件)' for h, c in top3_hours)

# 示唆を組み立て
parts = []
parts.append(f'ピーク集中帯: {top3_str}。')
parts.append(f'最活発曜日: {peak_dow_label}。')

if late_pct >= 20:
    parts.append(f'深夜作業率{late_pct}%。慢性化すると判断力が鈍りやすい。')
elif late_pct >= 10:
    parts.append(f'深夜作業率{late_pct}%。許容範囲だが注視。')
else:
    parts.append(f'深夜作業率{late_pct}%。健全。')

if weekend_pct >= 20:
    parts.append(f'週末稼働{weekend_pct}%。意図的な作業か惰性か、振り返る価値あり。')
elif weekend_pct > 0:
    parts.append(f'週末稼働{weekend_pct}%。')

if min_weekday_count < total / 7 * 0.5:
    parts.append(f'{min_weekday_label}曜の稼働が極端に少ない({min_weekday_count}件)。MTG集中日 or 意図的なオフ？')

print(' '.join(parts))
" 2>/dev/null)

if [ -z "$INSIGHT" ]; then
  exit 0
fi

# --- ceo_insights に UPSERT（work_rhythm は1レコードに上書き） ---
ESC_INSIGHT=$(echo "$INSIGHT" | sed "s/'/''/g")
TODAY=$(date +%Y-%m-%d)

cat > /tmp/work_rhythm_upsert.sql << EOSQL
DELETE FROM ceo_insights WHERE category = 'work_rhythm';
INSERT INTO ceo_insights (category, insight, evidence, confidence)
VALUES ('work_rhythm', '${ESC_INSIGHT}', 'prompt_log 直近30日の時間帯・曜日分布から自動算出 (${TODAY})', 'high');
EOSQL

run_sql_file /tmp/work_rhythm_upsert.sql > /dev/null

echo "稼働リズム示唆を更新しました"
exit 0
