#!/bin/bash
# News collection batch script
#
# news-collect Edge Function を直接叩くだけのシンプル実装。
# Edge Function 側で intelligence_sources テーブルの enabled ソースを
# 読み込み、Google News RSS / Hacker News / GitHub Releases /
# arXiv / 各社公式Blog を並列フェッチして news_items に upsert する。
# 日付フィルタ（古い記事の除外）は各フェッチャー側で既に実装済み。
#
# 以前は ai-agent の web_search を LLM 経由で叩いて JSON を作らせて
# いたが、DuckDuckGo では日付絞り込みが効かず古い記事ばかりが混入
# する問題があったため廃止。
#
# Required env vars: SUPABASE_URL, SUPABASE_ANON_KEY

set -euo pipefail

echo "📰 Calling news-collect Edge Function..."

RESPONSE=$(curl -sS -X POST "${SUPABASE_URL}/functions/v1/news-collect" \
  -H "Content-Type: application/json" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}")

echo "${RESPONSE}" | python3 -m json.tool || echo "${RESPONSE}"

SAVED=$(echo "${RESPONSE}" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('saved', 0))
except Exception:
    print(0)
")

echo "✅ Saved ${SAVED} new items"

if [ "${SAVED}" = "0" ]; then
  echo "⚠️ No new items were inserted. Either the feeds returned nothing new or all items already existed (upsert)."
fi
