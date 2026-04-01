#!/bin/bash
# Hook: PostToolUse (Edit/Write) — 編集ファイルが artifacts 登録済みなら自動同期
# artifacts-cache.json（SessionStart時に artifact-sync.sh が生成）を参照し、
# 該当ファイルの content を Supabase に PATCH する。

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CACHE_FILE="$SCRIPT_DIR/artifacts-cache.json"

# キャッシュがなければスキップ（SessionStart前 or 未登録）
[ -f "$CACHE_FILE" ] || exit 0

# ツール入力からファイルパスを取得
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)
[ -n "$FILE_PATH" ] && [ -f "$FILE_PATH" ] || exit 0

# 正規化
FILE_PATH=$(realpath "$FILE_PATH" 2>/dev/null || echo "$FILE_PATH")

# キャッシュからartifact IDを検索
ARTIFACT_ID=$(python3 -c "
import json, sys
cache = json.load(open('$CACHE_FILE'))
print(cache.get('$FILE_PATH', ''))
" 2>/dev/null || true)

[ -n "$ARTIFACT_ID" ] || exit 0

# Supabase 接続情報
source "$SCRIPT_DIR/supabase-check.sh"
[ "$SUPABASE_AVAILABLE" = "true" ] || exit 0

# ファイル内容を読み取り、JSONペイロードを一時ファイル経由で PATCH
TMPFILE=$(mktemp /tmp/artifact-sync-XXXXXX.json)
trap "rm -f '$TMPFILE'" EXIT

python3 -c "
import json, hashlib, os

fpath = '$FILE_PATH'
with open(fpath, 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

new_hash = hashlib.sha256(content.encode()).hexdigest()[:16]
payload = {'content': content, 'content_hash': new_hash}

with open('$TMPFILE', 'w') as f:
    json.dump(payload, f)
" 2>/dev/null || exit 0

curl -4 -s -o /dev/null \
  "${SUPABASE_URL}/rest/v1/artifacts?id=eq.${ARTIFACT_ID}" \
  -X PATCH \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -H "x-ingest-key: ${SUPABASE_INGEST_KEY}" \
  -d @"$TMPFILE" \
  --connect-timeout 5 --max-time 30 2>/dev/null || true

exit 0
