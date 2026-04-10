#!/bin/bash
# News collection batch script
# Calls the ai-agent Edge Function with web_search to collect latest news.
# Saves results to news_items table via Supabase REST API.
#
# Required env vars: SUPABASE_URL, SUPABASE_ANON_KEY

set -euo pipefail

LIMIT="${1:-5}"
TOPICS="AI/LLM、Claude Code、OpenAI、Google AI、Meta AI、Cursor、MCP"

echo "📰 Collecting ${LIMIT} news items..."

# Call ai-agent Edge Function (OpenAI web_search)
RESPONSE=$(curl -sf "${SUPABASE_URL}/functions/v1/ai-agent" \
  -H "Content-Type: application/json" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -d "$(cat <<PAYLOAD
{
  "message": "web_searchツールを使って、${TOPICS} の最新ニュースを${LIMIT}件検索してください。各ニュースは以下のJSON配列で返してください:\n[{\"title\":\"タイトル\",\"summary\":\"1行要約\",\"url\":\"記事URL\",\"source\":\"ソース名\",\"topic\":\"トピック\",\"date\":\"YYYY-MM-DD\"}]\n最終回答はJSON配列のみ返してください。説明文は不要です。",
  "system_prompt": "あなたはニュース収集エージェントです。web_searchツールで最新ニュースを検索し、結果をJSON配列形式で返してください。",
  "model": "gpt-5-mini",
  "max_tokens": 2000
}
PAYLOAD
)")

# Extract JSON array from response
NEWS=$(echo "${RESPONSE}" | python3 -c "
import sys, json, re
data = json.load(sys.stdin)
text = data.get('response', data.get('content', ''))
# Find JSON array in response
match = re.search(r'\[.*\]', text, re.DOTALL)
if match:
    items = json.loads(match.group())
    print(json.dumps(items))
else:
    print('[]')
" 2>/dev/null || echo '[]')

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
    # Only valid items
    if len(row['title']) >= 5:
        print(json.dumps(row))
" | while IFS= read -r ROW; do
  curl -sf "${SUPABASE_URL}/rest/v1/news_items" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d "${ROW}" > /dev/null 2>&1 && echo "  ✓ Saved: $(echo "${ROW}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["title"][:50])')" || true
done

echo "✅ News collection complete"
