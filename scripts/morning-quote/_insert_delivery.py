#!/usr/bin/env python3
"""
_insert_delivery.py --picked <JSON> --user <USER_ID> --date <YYYY-MM-DD> --diary-id <ID>

Step 6: user_quote_deliveries に INSERT する。UNIQUE (user_id, delivery_date) で冪等。
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--picked", required=True)
    parser.add_argument("--user", required=True)
    parser.add_argument("--date", required=True)
    parser.add_argument("--diary-id", required=True)
    args = parser.parse_args()

    try:
        picked = json.loads(args.picked)
    except Exception:
        print("[insert_delivery] invalid picked JSON", file=sys.stderr)
        return 1

    if not picked or not picked.get("quote_id"):
        print("[insert_delivery] no quote_id, skip", file=sys.stderr)
        return 0

    SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
    SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
    SUPABASE_INGEST_KEY = os.environ.get("SUPABASE_INGEST_KEY", "")

    payload = {
        "user_id": None if args.user == "NULL" else args.user,
        "quote_id": picked["quote_id"],
        "delivery_date": args.date,
        "score": picked.get("score"),
        "score_breakdown": picked.get("score_breakdown") or {},
        "trigger_diary_entry_id": int(args.diary_id) if args.diary_id else None,
    }

    url = f"{SUPABASE_URL}/rest/v1/user_quote_deliveries"
    try:
        r = subprocess.run(
            [
                "curl", "-s", "-X", "POST", url,
                "-H", f"apikey: {SUPABASE_ANON_KEY}",
                "-H", f"Authorization: Bearer {SUPABASE_ANON_KEY}",
                "-H", f"x-ingest-key: {SUPABASE_INGEST_KEY}",
                "-H", "Content-Type: application/json",
                "-H", "Prefer: return=minimal",
                "-d", json.dumps(payload, ensure_ascii=False),
            ],
            capture_output=True, text=True, timeout=30,
        )
        if r.returncode == 0:
            return 0
        print(f"[insert_delivery] curl failed: {r.stderr}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"[insert_delivery] error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
