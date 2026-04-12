#!/bin/bash
# News collection batch script
# Calls the ai-agent Edge Function (SSE streaming) with web_search to collect latest news.
# Saves results to news_items table via Supabase REST API.
#
# Required env vars: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_INGEST_KEY

set -euo pipefail

LIMIT="${1:-5}"
TOPICS="AI/LLM、Claude Code、OpenAI、Google AI、Meta AI、Cursor、MCP"
TODAY=$(date -u +%Y-%m-%d)

echo "📰 Collecting ${LIMIT} news items (target: last 7 days)..."

# Call ai-agent Edge Function — response is SSE stream
# web_search の time_range="week" を使って直近1週間の記事だけに絞る
SSE_RAW=$(curl -s "${SUPABASE_URL}/functions/v1/ai-agent" \
  -H "Content-Type: application/json" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -d "{
  \"message\": \"web_searchツールを time_range=\\\"week\\\" で使って、${TOPICS} の直近1週間以内のニュースを${LIMIT}件検索してください。今日は ${TODAY} です。1週間より古い記事は除外してください。各ニュースは以下のJSON配列で返してください:\\n[{\\\"title\\\":\\\"タイトル（日本語）\\\",\\\"summary\\\":\\\"2-3文の日本語要約。英語の記事や論文も必ず日本語で要約する。何が重要なのか、どう使えるかを含める\\\",\\\"url\\\":\\\"記事URL\\\",\\\"source\\\":\\\"ソース名\\\",\\\"topic\\\":\\\"トピック\\\",\\\"date\\\":\\\"YYYY-MM-DD\\\"}]\\n date は本日から7日以内にしてください。最終回答はJSON配列のみ返してください。説明文は不要です。\",
  \"system_prompt\": \"あなたはニュース収集エージェントです。web_searchツールの time_range パラメータを必ず 'week' に設定して直近1週間のニュースだけを検索してください。1週間より古い記事は除外してください。titleとsummaryは必ず日本語で書いてください。英語の記事や論文も日本語に翻訳して要約します。\",
  \"model\": \"gpt-5-mini\",
  \"max_tokens\": 2000
}")

# Parse SSE stream: concatenate all delta content tokens into full text
NEWS=$(echo "${SSE_RAW}" | python3 -c "
import sys, json, re

text = ''
for line in sys.stdin:
    line = line.strip()
    if not line.startswith('data: '):
        continue
    payload = line[6:]
    try:
        obj = json.loads(payload)
        if obj.get('type') == 'delta' and 'content' in obj:
            text += obj['content']
    except (json.JSONDecodeError, KeyError):
        pass

# Extract JSON array from assembled text
match = re.search(r'\[.*\]', text, re.DOTALL)
if match:
    try:
        items = json.loads(match.group())
        print(json.dumps(items, ensure_ascii=False))
    except json.JSONDecodeError:
        print('[]')
else:
    print('[]')
")

COUNT=$(echo "${NEWS}" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
echo "Found ${COUNT} items"

if [ "${COUNT}" = "0" ]; then
  echo "No news items found, skipping."
  exit 0
fi

# Insert each item into news_items table
echo "${NEWS}" | python3 -c "
import sys, json
from datetime import datetime

items = json.load(sys.stdin)
for item in items:
    row = {
        'title': item.get('title', '')[:200],
        'summary': item.get('summary', '')[:500],
        'url': item.get('url'),
        'source': item.get('source', 'web_search')[:100],
        'topic': item.get('topic', '')[:100],
        'published_date': item.get('date'),
        'collected_at': datetime.utcnow().isoformat() + 'Z',
    }
    if len(row['title']) >= 5:
        print(json.dumps(row, ensure_ascii=False))
" | while IFS= read -r ROW; do
  curl -s "${SUPABASE_URL}/rest/v1/news_items" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -H "x-ingest-key: ${SUPABASE_INGEST_KEY}" \
    -d "${ROW}" > /dev/null 2>&1 && echo "  ✓ $(echo "${ROW}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["title"][:60])')" || echo "  ✗ INSERT failed"
done

echo "✅ News collection complete"
