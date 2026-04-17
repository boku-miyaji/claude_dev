#!/bin/bash
# Backfill emotion_analysis for all diary entries using curl
# Usage: bash scripts/backfill-emotions.sh

set -euo pipefail

# Load env
source ~/.claude/hooks/supabase.env 2>/dev/null || true

SUPABASE_URL="https://akycymnahqypmtsfqhtr.supabase.co"
ANON_KEY="sb_publishable_VYgxoltXaSlEIjcH1dpa7w_TPc3mYBf"

if [ -z "${SUPABASE_INGEST_KEY:-}" ]; then
  echo "ERROR: SUPABASE_INGEST_KEY not set"
  exit 1
fi

PROMPT='あなたは感情分析の専門家です。日記のテキストを分析し、以下のJSON形式(json)で返してください:\n{\n  "plutchik": { "joy": 0, "trust": 0, "fear": 0, "surprise": 0, "sadness": 0, "disgust": 0, "anger": 0, "anticipation": 0 },\n  "russell": { "valence": 0.0, "arousal": 0.0 },\n  "perma_v": { "p": 0, "e": 0, "r": 0, "m": 0, "a": 0, "v": 0 },\n  "wbi": 0,\n  "summary": "感情の要約（1文）"\n}\nPlutchikの各値は0-100の整数。russellは-1.0〜1.0。PERMA+Vは0-10。WBIはPERMA+Vの加重平均(0-10)。JSON以外は返さないでください。'

echo "Fetching diary entries..."

# Get all diary entry IDs and bodies
ENTRIES=$(curl -s "$SUPABASE_URL/rest/v1/diary_entries?select=id,body&order=created_at.asc" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "x-ingest-key: $SUPABASE_INGEST_KEY")

# Get existing emotion analyses
EXISTING=$(curl -s "$SUPABASE_URL/rest/v1/emotion_analysis?select=diary_entry_id" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "x-ingest-key: $SUPABASE_INGEST_KEY")

TOTAL=$(echo "$ENTRIES" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
DONE=$(echo "$EXISTING" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
echo "  Total: $TOTAL, Already done: $DONE"

# Process with Python + curl
python3 -u << 'PYEOF'
import json, subprocess, sys, time, os

entries = json.loads(os.environ.get("ENTRIES", "[]"))
existing_raw = json.loads(os.environ.get("EXISTING", "[]"))
existing_ids = {e["diary_entry_id"] for e in existing_raw}

todo = [e for e in entries if e["id"] not in existing_ids]
print(f"  To analyze: {len(todo)}")

SUPABASE_URL = os.environ["SUPABASE_URL"]
ANON_KEY = os.environ["ANON_KEY"]
INGEST_KEY = os.environ["SUPABASE_INGEST_KEY"]
PROMPT = os.environ["PROMPT"]

success = 0
errors = 0

for i, entry in enumerate(todo):
    body = (entry.get("body") or "").strip()
    if not body or len(body) < 10:
        print(f"  [{i+1}/{len(todo)}] #{entry['id']} - Skipped (short)")
        continue

    text = body[:2000]

    payload = json.dumps({
        "mode": "completion",
        "message": text,
        "system_prompt": PROMPT,
        "model": "gpt-5-nano",
        "max_tokens": 1000,
        "response_format": {"type": "json_object"},
    })

    # Call Edge Function with curl
    result = subprocess.run([
        "curl", "-s", "-w", "\n%{http_code}",
        f"{SUPABASE_URL}/functions/v1/ai-agent",
        "-X", "POST",
        "-H", "Content-Type: application/json",
        "-H", f"Authorization: Bearer {ANON_KEY}",
        "-H", f"apikey: {ANON_KEY}",
        "-d", payload,
    ], capture_output=True, text=True, timeout=60)

    lines = result.stdout.strip().rsplit("\n", 1)
    if len(lines) < 2:
        print(f"  [{i+1}/{len(todo)}] #{entry['id']} - ERROR: empty response")
        errors += 1
        time.sleep(2)
        continue

    response_body, status_code = lines[0], lines[1].strip()

    if status_code != "200":
        print(f"  [{i+1}/{len(todo)}] #{entry['id']} - HTTP {status_code}")
        errors += 1
        time.sleep(3)
        continue

    try:
        r = json.loads(response_body)
        content = json.loads(r["content"])
        pl = content.get("plutchik", {})
        ru = content.get("russell", {})
        pv = content.get("perma_v", {})
        wbi = content.get("wbi", 0)

        # Insert emotion_analysis
        ins_payload = json.dumps({
            "diary_entry_id": entry["id"],
            "joy": pl.get("joy", 0), "trust": pl.get("trust", 0),
            "fear": pl.get("fear", 0), "surprise": pl.get("surprise", 0),
            "sadness": pl.get("sadness", 0), "disgust": pl.get("disgust", 0),
            "anger": pl.get("anger", 0), "anticipation": pl.get("anticipation", 0),
            "valence": ru.get("valence", 0), "arousal": ru.get("arousal", 0),
            "perma_p": pv.get("p", 0), "perma_e": pv.get("e", 0),
            "perma_r": pv.get("r", 0), "perma_m": pv.get("m", 0),
            "perma_a": pv.get("a", 0), "perma_v": pv.get("v", 0),
            "wbi_score": wbi, "model_used": "gpt-5-nano",
        })

        subprocess.run([
            "curl", "-s",
            f"{SUPABASE_URL}/rest/v1/emotion_analysis",
            "-X", "POST",
            "-H", "Content-Type: application/json",
            "-H", f"apikey: {ANON_KEY}",
            "-H", f"Authorization: Bearer {ANON_KEY}",
            "-H", f"x-ingest-key: {INGEST_KEY}",
            "-H", "Prefer: return=minimal",
            "-d", ins_payload,
        ], capture_output=True, timeout=10)

        # Update diary wbi
        subprocess.run([
            "curl", "-s",
            f"{SUPABASE_URL}/rest/v1/diary_entries?id=eq.{entry['id']}",
            "-X", "PATCH",
            "-H", "Content-Type: application/json",
            "-H", f"apikey: {ANON_KEY}",
            "-H", f"Authorization: Bearer {ANON_KEY}",
            "-H", f"x-ingest-key: {INGEST_KEY}",
            "-d", json.dumps({"wbi": wbi}),
        ], capture_output=True, timeout=10)

        summary = content.get("summary", "")[:40]
        print(f"  [{i+1}/{len(todo)}] #{entry['id']} - WBI={wbi:.1f} {summary}")
        success += 1

    except Exception as e:
        print(f"  [{i+1}/{len(todo)}] #{entry['id']} - PARSE ERROR: {e}")
        errors += 1

    time.sleep(1)

print(f"\nDone! Success: {success}, Errors: {errors}, Skipped: {len(todo) - success - errors}")
PYEOF
