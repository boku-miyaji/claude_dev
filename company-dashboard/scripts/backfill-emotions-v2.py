#!/usr/bin/env python3
"""Backfill emotion_analysis using curl (avoids Python urllib 401 issue)."""

import json
import os
import subprocess
import sys
import time

sys.stdout.reconfigure(line_buffering=True)

SUPABASE_URL = "https://akycymnahqypmtsfqhtr.supabase.co"
ANON_KEY = "sb_publishable_VYgxoltXaSlEIjcH1dpa7w_TPc3mYBf"

# Load ingest key
INGEST_KEY = ""
with open(os.path.expanduser("~/.claude/hooks/supabase.env")) as f:
    for line in f:
        if line.strip().startswith("SUPABASE_INGEST_KEY="):
            INGEST_KEY = line.strip().split("=", 1)[1].strip().strip('"')

PROMPT = (
    'あなたは感情分析の専門家です。日記のテキストを分析し、以下のJSON形式(json)で返してください: '
    '{"plutchik":{"joy":0,"trust":0,"fear":0,"surprise":0,"sadness":0,"disgust":0,"anger":0,"anticipation":0},'
    '"russell":{"valence":0.0,"arousal":0.0},'
    '"perma_v":{"p":0,"e":0,"r":0,"m":0,"a":0,"v":0},'
    '"wbi":0,"summary":"感情の要約（1文）"}. '
    'Plutchikの各値は0-100整数。russellは-1.0~1.0。PERMA+Vは0-10実数。WBIはPERMA+V加重平均(0-10)。JSON以外返さないでください。'
)


def curl_ef(message):
    """Call Edge Function via curl."""
    payload = json.dumps({
        "mode": "completion",
        "message": message,
        "system_prompt": PROMPT,
        "model": "gpt-5-nano",
        "max_tokens": 1000,
        "response_format": {"type": "json_object"},
    })
    r = subprocess.run(
        ["curl", "-s", "-w", "\n%{http_code}",
         f"{SUPABASE_URL}/functions/v1/ai-agent",
         "-X", "POST",
         "-H", "Content-Type: application/json",
         "-H", f"Authorization: Bearer {ANON_KEY}",
         "-H", f"apikey: {ANON_KEY}",
         "-d", payload],
        capture_output=True, text=True, timeout=60,
    )
    lines = r.stdout.strip().rsplit("\n", 1)
    if len(lines) < 2:
        return None, "empty"
    return lines[0], lines[1].strip()


def curl_insert(table, data):
    subprocess.run(
        ["curl", "-s",
         f"{SUPABASE_URL}/rest/v1/{table}",
         "-X", "POST",
         "-H", "Content-Type: application/json",
         "-H", f"apikey: {ANON_KEY}",
         "-H", f"Authorization: Bearer {ANON_KEY}",
         "-H", f"x-ingest-key: {INGEST_KEY}",
         "-H", "Prefer: return=minimal",
         "-d", json.dumps(data)],
        capture_output=True, timeout=10,
    )


def curl_patch(path, data):
    subprocess.run(
        ["curl", "-s",
         f"{SUPABASE_URL}/rest/v1/{path}",
         "-X", "PATCH",
         "-H", "Content-Type: application/json",
         "-H", f"apikey: {ANON_KEY}",
         "-H", f"Authorization: Bearer {ANON_KEY}",
         "-H", f"x-ingest-key: {INGEST_KEY}",
         "-d", json.dumps(data)],
        capture_output=True, timeout=10,
    )


# Load entries from file
entries = json.load(open("/tmp/diary_entries.json"))
print(f"Total entries: {len(entries)}")

# Check existing
r = subprocess.run(
    ["curl", "-s",
     f"{SUPABASE_URL}/rest/v1/emotion_analysis?select=diary_entry_id",
     "-H", f"apikey: {ANON_KEY}",
     "-H", f"Authorization: Bearer {ANON_KEY}",
     "-H", f"x-ingest-key: {INGEST_KEY}"],
    capture_output=True, text=True, timeout=10,
)
existing_ids = {e["diary_entry_id"] for e in json.loads(r.stdout)}
print(f"Already analyzed: {len(existing_ids)}")

todo = [e for e in entries if e["id"] not in existing_ids]
print(f"To analyze: {len(todo)}")

success = errors = skipped = 0

for i, entry in enumerate(todo):
    body = (entry.get("body") or "").strip()
    if not body or len(body) < 10:
        skipped += 1
        continue

    text = body[:2000]
    resp_body, status = curl_ef(text)

    if status != "200":
        print(f"  [{i+1}/{len(todo)}] #{entry['id']} - HTTP {status}")
        errors += 1
        time.sleep(3)
        continue

    try:
        r = json.loads(resp_body)
        c = json.loads(r["content"])
        pl = c.get("plutchik", {})
        ru = c.get("russell", {})
        pv = c.get("perma_v", {})
        wbi = c.get("wbi", 0)

        curl_insert("emotion_analysis", {
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

        curl_patch(f"diary_entries?id=eq.{entry['id']}", {"wbi": wbi})

        summary = c.get("summary", "")[:40]
        print(f"  [{i+1}/{len(todo)}] #{entry['id']} - WBI={wbi:.1f} {summary}")
        success += 1

    except Exception as e:
        print(f"  [{i+1}/{len(todo)}] #{entry['id']} - ERROR: {e}")
        errors += 1

    time.sleep(1)

print(f"\nDone! Success: {success}, Errors: {errors}, Skipped: {skipped}")
