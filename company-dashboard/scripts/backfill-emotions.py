#!/usr/bin/env python3 -u
"""
Backfill emotion_analysis for all diary entries that don't have one yet.
Uses the Edge Function (completion mode) to analyze each diary entry.
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error

# Force unbuffered output
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

# --- Config ---
SUPABASE_URL = "https://akycymnahqypmtsfqhtr.supabase.co"
ANON_KEY = "sb_publishable_VYgxoltXaSlEIjcH1dpa7w_TPc3mYBf"
INGEST_KEY = os.environ.get("SUPABASE_INGEST_KEY", "")

# Try to load from supabase.env if not in environment
if not INGEST_KEY:
    env_file = os.path.expanduser("~/.claude/hooks/supabase.env")
    if os.path.exists(env_file):
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line.startswith("SUPABASE_INGEST_KEY="):
                    INGEST_KEY = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break

if not INGEST_KEY:
    print("ERROR: SUPABASE_INGEST_KEY not found.")
    sys.exit(1)

HEADERS = {
    "apikey": ANON_KEY,
    "Authorization": f"Bearer {ANON_KEY}",
    "x-ingest-key": INGEST_KEY,
    "Content-Type": "application/json",
}

EMOTION_PROMPT = """あなたは感情分析の専門家です。日記のテキストを分析し、以下のJSON形式(json)で返してください:
{
  "plutchik": { "joy": 0, "trust": 0, "fear": 0, "surprise": 0, "sadness": 0, "disgust": 0, "anger": 0, "anticipation": 0 },
  "russell": { "valence": 0.0, "arousal": 0.0 },
  "perma_v": { "p": 0, "e": 0, "r": 0, "m": 0, "a": 0, "v": 0 },
  "wbi": 0,
  "summary": "感情の要約（1文）"
}
Plutchikの各値は0-100の整数。混合感情も検出してください。強い感情は80以上、弱い感情は20以下。
russellのvalenceは-1.0〜1.0（ネガティブ〜ポジティブ）、arousalは-1.0〜1.0（低覚醒〜高覚醒）。
PERMA+Vは0-10の実数: P=ポジティブ感情, E=没頭, R=人間関係, M=意味, A=達成, V=活力。
WBIはPERMA+Vの加重平均（0-10）。
JSON以外は返さないでください。"""


def supabase_get(path):
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}", headers=HEADERS)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def supabase_post(path, data):
    body = json.dumps(data).encode()
    headers = {**HEADERS, "Prefer": "return=representation"}
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}", data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def supabase_patch(path, data):
    body = json.dumps(data).encode()
    headers = {**HEADERS, "Prefer": "return=representation"}
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}", data=body, headers=headers, method="PATCH")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def call_edge_function(message, system_prompt, retries=3):
    """Call the ai-agent Edge Function in completion mode with retries."""
    payload = {
        "mode": "completion",
        "message": message,
        "system_prompt": system_prompt,
        "model": "gpt-5-nano",
        "max_tokens": 1000,
        "response_format": {"type": "json_object"},
    }
    body = json.dumps(payload).encode()
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {ANON_KEY}",
        "apikey": ANON_KEY,
    }

    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                f"{SUPABASE_URL}/functions/v1/ai-agent",
                data=body,
                headers=headers,
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            if e.code in (401, 429, 500, 502, 503) and attempt < retries - 1:
                wait = (attempt + 1) * 3
                print(f"    Retry {attempt+1}/{retries} after {wait}s (HTTP {e.code})")
                time.sleep(wait)
            else:
                raise


def main():
    # 1. Get all diary entries
    print("Fetching diary entries...")
    entries = supabase_get("diary_entries?select=id,body,created_at&order=created_at.asc")
    print(f"  Total diary entries: {len(entries)}")

    # 2. Get existing emotion analyses
    existing = supabase_get("emotion_analysis?select=diary_entry_id")
    existing_ids = {e["diary_entry_id"] for e in existing}
    print(f"  Already analyzed: {len(existing_ids)}")

    # 3. Filter to unanalyzed
    todo = [e for e in entries if e["id"] not in existing_ids]
    print(f"  To analyze: {len(todo)}")

    if not todo:
        print("Nothing to do!")
        return

    # 4. Process each entry
    success = 0
    errors = 0
    for i, entry in enumerate(todo):
        body = (entry.get("body") or "").strip()
        if not body or len(body) < 10:
            print(f"  [{i+1}/{len(todo)}] #{entry['id']} - Skipped (too short)")
            continue

        # Truncate very long entries
        text = body[:2000] if len(body) > 2000 else body

        try:
            result = call_edge_function(text, EMOTION_PROMPT)
            content = result.get("content", "")
            if not content:
                print(f"  [{i+1}/{len(todo)}] #{entry['id']} - Empty response, skipping")
                errors += 1
                continue

            parsed = json.loads(content)
            plutchik = parsed.get("plutchik", {})
            russell = parsed.get("russell", {})
            perma = parsed.get("perma_v", {})
            wbi = parsed.get("wbi", 0)

            # Insert emotion_analysis
            supabase_post("emotion_analysis", {
                "diary_entry_id": entry["id"],
                "joy": plutchik.get("joy", 0),
                "trust": plutchik.get("trust", 0),
                "fear": plutchik.get("fear", 0),
                "surprise": plutchik.get("surprise", 0),
                "sadness": plutchik.get("sadness", 0),
                "disgust": plutchik.get("disgust", 0),
                "anger": plutchik.get("anger", 0),
                "anticipation": plutchik.get("anticipation", 0),
                "valence": russell.get("valence", 0),
                "arousal": russell.get("arousal", 0),
                "perma_p": perma.get("p", 0),
                "perma_e": perma.get("e", 0),
                "perma_r": perma.get("r", 0),
                "perma_m": perma.get("m", 0),
                "perma_a": perma.get("a", 0),
                "perma_v": perma.get("v", 0),
                "wbi_score": wbi,
                "model_used": "gpt-5-nano",
            })

            # Update diary_entries.wbi
            supabase_patch(f"diary_entries?id=eq.{entry['id']}", {"wbi": wbi})

            summary = parsed.get("summary", "")[:40]
            print(f"  [{i+1}/{len(todo)}] #{entry['id']} - WBI={wbi:.1f} {summary}")
            success += 1

            # Rate limit: ~1 req/sec to avoid hitting limits
            time.sleep(1.0)

        except Exception as e:
            print(f"  [{i+1}/{len(todo)}] #{entry['id']} - ERROR: {e}")
            errors += 1
            time.sleep(1)

    print(f"\nDone! Success: {success}, Errors: {errors}, Skipped: {len(todo) - success - errors}")


if __name__ == "__main__":
    main()
