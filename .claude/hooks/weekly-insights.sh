#!/bin/bash
# weekly-insights.sh — 週次プロダクト分析バッチ
#
# プロダクト（focus-you）の自己理解・自己改善のための定量/定性分析を
# 週1回実行し、結果を ceo_insights (source='product') に書き込む。
# 書き込まれた insight は AIチャット (v4) の system prompt に
# 自動注入され、パートナーが本人の傾向を踏まえた応答を返せるようになる。
#
# 実行場所: SessionStart hook。7日間 throttle 付き
# 依存: supabase.env, claude CLI (haiku)
#
# 8つの分析:
#   1. ハビッツ継続 vs 気分
#   2. 予定密度 vs 気分（前日/当日/翌日）
#   3. 月次 PERMA-V トレンド
#   4. タスク完了率トレンド
#   5. 夢・目標の進捗推移
#   6. API コスト月次
#   7. 時間予測精度
#   8. 気分の転換点検出

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "${SCRIPT_DIR}/supabase.env" ] || exit 0
source "${SCRIPT_DIR}/supabase.env" 2>/dev/null || exit 0

LAST_RUN_FILE="${SCRIPT_DIR}/.weekly-insights-last-run"
PROJECT_ID="akycymnahqypmtsfqhtr"

# --- 7日チェック（--force で強制実行） ---
if [ "${1:-}" != "--force" ] && [ -f "$LAST_RUN_FILE" ]; then
  LAST_EPOCH=$(date -d "$(cat "$LAST_RUN_FILE")" +%s 2>/dev/null || echo 0)
  NOW_EPOCH=$(date +%s)
  ELAPSED=$(( NOW_EPOCH - LAST_EPOCH ))
  if [ "$ELAPSED" -lt $((7 * 86400)) ]; then
    DAYS_AGO=$(( ELAPSED / 86400 ))
    echo "weekly-insights: last run ${DAYS_AGO}d ago (< 7d). Skip."
    exit 0
  fi
fi

echo "=== Weekly Product Insights ==="
date '+%Y-%m-%d %H:%M:%S'
echo ""

# Management API helper (ファイルベースでペイロードを作って安全に送る)
run_sql() {
  local QUERY="$1"
  local OUT="${2:-/dev/null}"
  local REQ="/tmp/wi_req_$$.json"
  printf '%s' "$QUERY" | python3 -c 'import sys,json; print(json.dumps({"query": sys.stdin.read()}))' > "$REQ"
  curl -sS -X POST "https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    --data-binary @"$REQ" > "$OUT" 2>&1
  local RC=$?
  rm -f "$REQ"
  return $RC
}

# ceo_insights に upsert（category 単位で置換）
save_insight() {
  local CATEGORY="$1"
  local INSIGHT="$2"
  local EVIDENCE="$3"
  local CONFIDENCE="${4:-medium}"

  # SQL シングルクォートエスケープ
  local ESC_INSIGHT=$(printf '%s' "$INSIGHT" | sed "s/'/''/g")
  local ESC_EVIDENCE=$(printf '%s' "$EVIDENCE" | sed "s/'/''/g")

  # 同じ category の product レコードは削除して新規 insert（常に最新1件）
  local SQL="DELETE FROM ceo_insights WHERE category='${CATEGORY}' AND source='product'; INSERT INTO ceo_insights (category, insight, evidence, confidence, source) VALUES ('${CATEGORY}', '${ESC_INSIGHT}', '${ESC_EVIDENCE}', '${CONFIDENCE}', 'product');"
  local RESP=$(mktemp)
  run_sql "$SQL" "$RESP"
  if grep -q '"error"\|"message"' "$RESP" 2>/dev/null; then
    echo "  ⚠ save error: $(cat "$RESP")"
  fi
  rm -f "$RESP"
}

# LLM 解釈（claude CLI 経由、API 課金なし）
interpret_with_llm() {
  local PROMPT="$1"
  local DATA="$2"
  if ! command -v claude >/dev/null 2>&1; then
    echo ""
    return
  fi
  claude --print --model haiku "${PROMPT}

${DATA}" 2>/dev/null || echo ""
}

# ============================================================
# 1. ハビッツ継続 vs 気分
# ============================================================
echo "--- [1/8] habits vs mood ---"

run_sql "
WITH daily AS (
  SELECT
    (completed_at AT TIME ZONE 'Asia/Tokyo')::date AS d,
    COUNT(*) AS done_count
  FROM habit_logs
  WHERE completed_at >= NOW() - INTERVAL '30 days'
  GROUP BY 1
),
mood AS (
  SELECT entry_date AS d, AVG(wbi) AS avg_wbi
  FROM diary_entries
  WHERE entry_date >= CURRENT_DATE - 30 AND wbi IS NOT NULL
  GROUP BY 1
),
joined AS (
  SELECT m.d, m.avg_wbi, COALESCE(h.done_count, 0) AS done_count
  FROM mood m LEFT JOIN daily h USING (d)
)
SELECT
  ROUND(AVG(avg_wbi) FILTER (WHERE done_count >= 2)::numeric, 2) AS mood_high_habit,
  ROUND(AVG(avg_wbi) FILTER (WHERE done_count = 0)::numeric, 2) AS mood_no_habit,
  COUNT(*) FILTER (WHERE done_count >= 2) AS days_high_habit,
  COUNT(*) FILTER (WHERE done_count = 0) AS days_no_habit
FROM joined;
" /tmp/wi_1.json

HABIT_DATA=$(cat /tmp/wi_1.json)
INSIGHT=$(interpret_with_llm "以下は過去30日の、ハビッツ2つ以上達成した日と全く達成しなかった日それぞれの気分平均(wbi 0-10)を比較したデータです。相関が読めますか？短く日本語1-2文で傾向を言葉にしてください。数字は使わず「達成した週は気分が高い傾向」「関係は弱い」のような定性的な表現で。" "$HABIT_DATA")

if [ -n "$INSIGHT" ]; then
  save_insight "habits_mood_correlation" "$INSIGHT" "過去30日 habit_logs vs diary_entries.wbi 比較" "medium"
  echo "  ✓ saved"
else
  echo "  - LLM unavailable, skip"
fi

# ============================================================
# 2. 予定密度 vs 気分（前日/当日/翌日）
# ============================================================
echo "--- [2/8] event density vs mood (3-day window) ---"

# Google Calendar events は DB に無いので、diary_entries.calendar_events の jsonb 件数で代替
run_sql "
WITH event_days AS (
  SELECT
    entry_date AS d,
    COALESCE(jsonb_array_length(calendar_events), 0) AS event_count
  FROM diary_entries
  WHERE entry_date >= CURRENT_DATE - 30 AND calendar_events IS NOT NULL
),
mood AS (
  SELECT entry_date AS d, AVG(wbi) AS avg_wbi
  FROM diary_entries
  WHERE entry_date >= CURRENT_DATE - 32 AND wbi IS NOT NULL
  GROUP BY 1
)
SELECT
  e.d AS event_day,
  e.event_count,
  m_prev.avg_wbi AS mood_prev_day,
  m_same.avg_wbi AS mood_same_day,
  m_next.avg_wbi AS mood_next_day
FROM event_days e
LEFT JOIN mood m_prev ON m_prev.d = e.d - 1
LEFT JOIN mood m_same ON m_same.d = e.d
LEFT JOIN mood m_next ON m_next.d = e.d + 1
WHERE e.event_count > 0
ORDER BY e.d DESC
LIMIT 30;
" /tmp/wi_2.json

EVENT_DATA=$(cat /tmp/wi_2.json)
INSIGHT=$(interpret_with_llm "以下は過去30日の『予定件数と、その前日・当日・翌日の気分平均』データです。予定が多い日の前後で気分がどう動いているか、定性的に日本語1-2文で。前日(anticipatory)、当日、翌日(spillover)のどれが最も強く響いているかが見えればそれを言う。" "$EVENT_DATA")

if [ -n "$INSIGHT" ]; then
  save_insight "event_density_mood" "$INSIGHT" "過去30日 calendar_events vs wbi（前日/当日/翌日）" "medium"
  echo "  ✓ saved"
else
  echo "  - LLM unavailable, skip"
fi

# ============================================================
# 3. 月次 PERMA-V トレンド
# ============================================================
echo "--- [3/8] monthly PERMA-V trend ---"

run_sql "
SELECT
  to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
  ROUND(AVG(perma_p)::numeric, 2) AS p,
  ROUND(AVG(perma_e)::numeric, 2) AS e,
  ROUND(AVG(perma_r)::numeric, 2) AS r,
  ROUND(AVG(perma_m)::numeric, 2) AS m,
  ROUND(AVG(perma_a)::numeric, 2) AS a,
  ROUND(AVG(perma_v)::numeric, 2) AS v,
  COUNT(*) AS entries
FROM emotion_analysis
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY 1 ORDER BY 1;
" /tmp/wi_3.json

PERMA_DATA=$(cat /tmp/wi_3.json)
INSIGHT=$(interpret_with_llm "以下は過去3ヶ月の PERMA-V（幸福の5要素+活力）月次平均です。P=ポジティブ感情 E=没頭 R=関係性 M=意味 A=達成 V=活力。どの要素が伸びていてどれが落ちているか、短く日本語1-2文で。数値は書かずに「達成感は上向き」のような言葉で。" "$PERMA_DATA")

if [ -n "$INSIGHT" ]; then
  save_insight "perma_v_trend" "$INSIGHT" "過去3ヶ月 emotion_analysis 月次 PERMA-V 比較" "medium"
  echo "  ✓ saved"
else
  echo "  - LLM unavailable, skip"
fi

# ============================================================
# 4. タスク完了率トレンド
# ============================================================
echo "--- [4/8] task completion rate ---"

run_sql "
WITH weekly AS (
  SELECT
    date_trunc('week', created_at) AS week,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE status = 'done') AS done
  FROM tasks
  WHERE created_at >= NOW() - INTERVAL '56 days' AND type = 'task'
  GROUP BY 1
)
SELECT
  to_char(week, 'MM/DD') AS week_start,
  done, total,
  ROUND((done::numeric / NULLIF(total, 0)) * 100, 0) AS rate_pct
FROM weekly ORDER BY week;
" /tmp/wi_4.json

TASK_DATA=$(cat /tmp/wi_4.json)
INSIGHT=$(interpret_with_llm "以下は週次のタスク作成数と完了数（過去8週）です。完了率の推移を短く日本語1-2文で。改善傾向/低下傾向/安定、のいずれか。数値は出さず言葉で。" "$TASK_DATA")

if [ -n "$INSIGHT" ]; then
  save_insight "task_completion_trend" "$INSIGHT" "過去8週間 tasks 週次 done/total 比率" "medium"
  echo "  ✓ saved"
else
  echo "  - LLM unavailable, skip"
fi

# ============================================================
# 5. 夢・目標の進捗推移
# ============================================================
echo "--- [5/8] dreams progress ---"

run_sql "
SELECT
  d.title,
  d.status,
  d.category,
  (
    SELECT COUNT(*)
    FROM diary_entries de
    WHERE de.created_at >= NOW() - INTERVAL '30 days'
      AND (de.body ILIKE '%' || SPLIT_PART(d.title, ' ', 1) || '%'
           OR (d.category IS NOT NULL AND de.body ILIKE '%' || d.category || '%'))
  ) AS mentions_30d
FROM dreams d
WHERE d.status IN ('active', 'in_progress')
ORDER BY d.priority DESC NULLS LAST
LIMIT 10;
" /tmp/wi_5.json

DREAM_DATA=$(cat /tmp/wi_5.json)
INSIGHT=$(interpret_with_llm "以下は active な夢・目標と、過去30日の日記でどれくらい言及されているかのデータです。どの夢に向かって実際に動いているか、逆に後回しになっているかを、日本語1-2文で。批判ではなく前向きに。" "$DREAM_DATA")

if [ -n "$INSIGHT" ]; then
  save_insight "dreams_progress" "$INSIGHT" "過去30日 diary 言及と dreams active 比較" "medium"
  echo "  ✓ saved"
else
  echo "  - LLM unavailable, skip"
fi

# ============================================================
# 6. API コスト月次
# ============================================================
echo "--- [6/8] API cost monthly ---"

run_sql "
SELECT
  to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
  ROUND(SUM(cost_usd)::numeric, 2) AS cost_usd,
  SUM(tokens_input + tokens_output) AS total_tokens,
  COUNT(*) AS calls
FROM api_cost_log
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY 1 ORDER BY 1;
" /tmp/wi_6.json

COST_DATA=$(cat /tmp/wi_6.json)
INSIGHT=$(interpret_with_llm "以下は過去3ヶ月の API コスト月次集計です。コストの推移を短く日本語1-2文で。横ばい/増加/減少のいずれか。具体的な金額は1回出しても良い（USD）。運営視点のメモとして。" "$COST_DATA")

if [ -n "$INSIGHT" ]; then
  save_insight "api_cost_monthly" "$INSIGHT" "過去3ヶ月 api_cost_log 月次集計" "high"
  echo "  ✓ saved"
else
  echo "  - LLM unavailable, skip"
fi

# ============================================================
# 7. 時間予測精度（estimated_minutes vs 実績は取れないので
#    見積もりありの done タスクの存在傾向だけ算出）
# ============================================================
echo "--- [7/8] time estimation coverage ---"

run_sql "
SELECT
  COUNT(*) FILTER (WHERE estimated_minutes IS NOT NULL) AS with_estimate,
  COUNT(*) FILTER (WHERE estimated_minutes IS NULL) AS without_estimate,
  ROUND(AVG(estimated_minutes) FILTER (WHERE estimated_minutes IS NOT NULL)::numeric, 0) AS avg_estimate_min
FROM tasks
WHERE type = 'task' AND created_at >= NOW() - INTERVAL '30 days';
" /tmp/wi_7.json

EST_DATA=$(cat /tmp/wi_7.json)
INSIGHT=$(interpret_with_llm "以下は過去30日のタスクで、時間見積もり(estimated_minutes) を入れた数/入れていない数/入れた場合の平均分数です。見積もりを入れる習慣があるかを短く日本語1-2文で。入れてないなら「見積もりを入れる習慣はまだ薄い」のように。" "$EST_DATA")

if [ -n "$INSIGHT" ]; then
  save_insight "time_estimation_habit" "$INSIGHT" "過去30日 tasks の estimated_minutes 入力率" "low"
  echo "  ✓ saved"
else
  echo "  - LLM unavailable, skip"
fi

# ============================================================
# 8. 気分の転換点検出
# ============================================================
echo "--- [8/8] mood turning points ---"

run_sql "
WITH daily_mood AS (
  SELECT entry_date, AVG(wbi) AS wbi
  FROM diary_entries
  WHERE entry_date >= CURRENT_DATE - 21 AND wbi IS NOT NULL
  GROUP BY entry_date
  ORDER BY entry_date
),
deltas AS (
  SELECT
    entry_date, wbi,
    wbi - LAG(wbi) OVER (ORDER BY entry_date) AS delta
  FROM daily_mood
)
SELECT
  d.entry_date,
  ROUND(d.wbi::numeric, 1) AS wbi,
  ROUND(d.delta::numeric, 1) AS delta,
  LEFT(de.body, 200) AS body_snippet
FROM deltas d
LEFT JOIN diary_entries de ON de.entry_date = d.entry_date
WHERE ABS(d.delta) >= 1.5
ORDER BY ABS(d.delta) DESC
LIMIT 5;
" /tmp/wi_8.json

TURN_DATA=$(cat /tmp/wi_8.json)
INSIGHT=$(interpret_with_llm "以下は過去3週間で気分が1.5以上上下した日と、その日の日記本文です。気分が急に上がった/下がったきっかけのパターンを、短く日本語1-2文で。プライバシーへの配慮で具体的な名前は出さず、「特定の人との時間」「◯◯の場面」のような抽象化で。" "$TURN_DATA")

if [ -n "$INSIGHT" ]; then
  save_insight "mood_turning_points" "$INSIGHT" "過去3週間 diary wbi delta >= 1.5 の日の本文分析" "medium"
  echo "  ✓ saved"
else
  echo "  - LLM unavailable, skip"
fi

# ============================================================
# Done
# ============================================================
date '+%Y-%m-%d' > "$LAST_RUN_FILE"
echo ""
echo "=== Weekly insights done. Results in ceo_insights (source='product'). ==="
