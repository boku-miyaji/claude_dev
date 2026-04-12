#!/bin/bash
# chat-effectiveness-weekly.sh
#
# 週次: AIチャットの応答効果を分析し、本人への学習結果を
# user_settings.chat_learned_effectiveness に保存する。
#
# 目的: 何が効いたか（やる気・幸せ指標の改善）を LLM が自然言語で分析し、
# 次週以降の応答に反映される自己改善サイクルを回す。
#
# 実行頻度: 週1回（crontab または GitHub Actions で）
# 依存: claude CLI（API課金を避けるため）、supabase.env

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/supabase.env"

PROJECT_ID="akycymnahqypmtsfqhtr"
WEEK_AGO=$(date -d "7 days ago" +%Y-%m-%d 2>/dev/null || date -v-7d +%Y-%m-%d)

echo "=== Chat Effectiveness Weekly Analysis ==="
echo "Window: ${WEEK_AGO} 〜 today"

# Management API でデータ取得（RLS があるため）
run_sql() {
  local QUERY="$1"
  local OUT="${2:-/dev/null}"
  curl -s -X POST "https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"query\": $(echo "$QUERY" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')}" \
    > "$OUT"
}

# ------------------------------------------------------------------
# Step 1: 直近1週間の chat_interactions を取得
# ------------------------------------------------------------------
echo "  [1/4] Fetching chat_interactions..."
run_sql "SELECT id, created_at::date as date, user_message, assistant_message, entry_point FROM chat_interactions WHERE created_at >= '${WEEK_AGO}' ORDER BY created_at DESC LIMIT 100;" /tmp/chat_week.json

COUNT=$(python3 -c "import json; print(len(json.load(open('/tmp/chat_week.json'))))" 2>/dev/null || echo 0)
echo "    Found ${COUNT} interactions"

if [ "$COUNT" = "0" ] || [ "$COUNT" = "null" ]; then
  echo "  No chat_interactions in the past week. Skip."
  exit 0
fi

# ------------------------------------------------------------------
# Step 2: 各 interaction に翌日の感情スコア変化を紐付け
# ------------------------------------------------------------------
echo "  [2/4] Linking next-day mood delta..."
run_sql "
UPDATE chat_interactions ci
SET next_day_mood_delta = (
  SELECT (next_day.wbi - same_day.wbi)
  FROM (SELECT AVG(wbi) as wbi FROM diary_entries WHERE entry_date = ci.created_at::date) same_day,
       (SELECT AVG(wbi) as wbi FROM diary_entries WHERE entry_date = ci.created_at::date + 1) next_day
)
WHERE ci.created_at >= '${WEEK_AGO}' AND ci.next_day_mood_delta IS NULL;
" > /dev/null

# ------------------------------------------------------------------
# Step 3: 翌日の日記での言及を検出
# ------------------------------------------------------------------
echo "  [3/4] Detecting next-day diary mentions..."
run_sql "
UPDATE chat_interactions ci
SET mentioned_in_next_diary = EXISTS (
  SELECT 1 FROM diary_entries d
  WHERE d.entry_date = ci.created_at::date + 1
    AND (d.body ILIKE '%AI%' OR d.body ILIKE '%言われ%' OR d.body ILIKE '%やってみ%' OR d.body ILIKE '%動けた%')
)
WHERE ci.created_at >= '${WEEK_AGO}' AND ci.mentioned_in_next_diary IS NULL;
" > /dev/null

# ------------------------------------------------------------------
# Step 4: LLM に効果分析を依頼し、user_settings に保存
# ------------------------------------------------------------------
echo "  [4/4] LLM analysis..."

if ! command -v claude >/dev/null 2>&1; then
  echo "  claude CLI not found. Skipping LLM analysis."
  exit 0
fi

# 分析用データを整形
python3 > /tmp/chat_analysis_input.txt <<PYEOF
import json
data = json.load(open('/tmp/chat_week.json'))
print(f"直近1週間のAIチャット応答記録 ({len(data)}件):")
print()
for i, row in enumerate(data[:50], 1):
    print(f"--- #{i} ({row['date']}) ---")
    print(f"ユーザー: {(row.get('user_message') or '')[:200]}")
    print(f"AI応答: {(row.get('assistant_message') or '')[:300]}")
    print()
PYEOF

ANALYSIS_PROMPT=$(cat <<'EOP'
あなたは focus-you というプロダクトの AI チャットアシスタントの改善担当です。
以下は過去1週間のAIチャットの応答ログです。

次の2点を自然言語で分析し、結果を箇条書きで8項目以内にまとめてください:

1. どういう応答がユーザーに効いていそうか（行動につながった、気分が上がった傾向）
2. どういう応答が効いてないか（反発、無視、冗長すぎた等）

結果は「このユーザーへの応答で効果的だったパターン」という見出しのもと、
短い日本語の箇条書きで出力してください。一項目20-40字程度。
閾値や定量分析ではなく、あなたの読み取りによる定性分析をしてください。
EOP
)

ANALYSIS_RESULT=$(claude --print --model sonnet "${ANALYSIS_PROMPT}

$(cat /tmp/chat_analysis_input.txt)" 2>/dev/null || echo "")

if [ -z "$ANALYSIS_RESULT" ]; then
  echo "  LLM analysis failed or empty. Skip save."
  exit 0
fi

# user_settings.chat_learned_effectiveness カラムに保存
# (Phase 2 で追加。カラムが未作成でもエラーにならないガード付き)
ESC_RESULT=$(echo "$ANALYSIS_RESULT" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')

run_sql "
DO \$\$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'chat_learned_effectiveness') THEN
    UPDATE user_settings SET chat_learned_effectiveness = ${ESC_RESULT};
  END IF;
END
\$\$;
" > /dev/null

echo "=== Done. Analysis saved. ==="
echo "$ANALYSIS_RESULT" | head -20
