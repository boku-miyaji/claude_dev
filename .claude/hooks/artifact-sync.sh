#!/bin/bash
# Hook: SessionStart → Supabase artifacts content sync
# Reads registered artifact file paths, checks for changes, updates content.
# Called by config-sync.sh.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/supabase-check.sh"
[ "$SUPABASE_AVAILABLE" = "true" ] || exit 0

PROJECT_DIR="${1:-${CLAUDE_PROJECT_DIR:-/workspace}}"

# Fetch all active artifacts
ARTIFACTS=$(curl -4 -s \
  "${SUPABASE_URL}/rest/v1/artifacts?status=eq.active&select=id,file_path,content_hash" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "x-ingest-key: ${SUPABASE_INGEST_KEY}" \
  --connect-timeout 5 --max-time 10 2>/dev/null) || exit 0

# Check if we got valid JSON array
echo "$ARTIFACTS" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null || exit 0

COUNT=$(echo "$ARTIFACTS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
[ "$COUNT" = "0" ] && exit 0

# Process each artifact
echo "$ARTIFACTS" | python3 -c "
import sys, json, hashlib, subprocess, os

artifacts = json.load(sys.stdin)
supabase_url = os.environ['SUPABASE_URL']
anon_key = os.environ['SUPABASE_ANON_KEY']
ingest_key = os.environ.get('SUPABASE_INGEST_KEY', '')

for art in artifacts:
    fpath = art['file_path']
    art_id = art['id']
    old_hash = art.get('content_hash') or ''

    # Resolve path (support relative to PROJECT_DIR)
    if not fpath.startswith('/'):
        fpath = os.path.join('$PROJECT_DIR', fpath)

    if not os.path.isfile(fpath):
        continue

    # Read file content
    try:
        with open(fpath, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
    except:
        continue

    # Check hash
    new_hash = hashlib.sha256(content.encode()).hexdigest()[:16]
    if new_hash == old_hash:
        continue  # No change

    # Update Supabase
    import urllib.request, urllib.error
    payload = json.dumps({
        'content': content,
        'content_hash': new_hash,
        'last_synced_at': 'now()'
    }).encode()

    # Use curl for consistency with other hooks
    subprocess.run([
        'curl', '-4', '-s', '-o', '/dev/null',
        f'{supabase_url}/rest/v1/artifacts?id=eq.{art_id}',
        '-X', 'PATCH',
        '-H', f'apikey: {anon_key}',
        '-H', f'Authorization: Bearer {anon_key}',
        '-H', 'Content-Type: application/json',
        '-H', 'Prefer: return=minimal',
        '-H', f'x-ingest-key: {ingest_key}',
        '-d', json.dumps({'content': content, 'content_hash': new_hash}),
        '--connect-timeout', '5', '--max-time', '15'
    ], capture_output=True)
" 2>/dev/null || true

exit 0
