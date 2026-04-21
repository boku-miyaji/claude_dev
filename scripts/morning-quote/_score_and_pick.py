#!/usr/bin/env python3
"""
_score_and_pick.py --themes <THEMES_JSON> --user <USER_ID>

stdin: 候補 JSON 配列（_fetch_candidates.py の出力）
stdout: 選定された1件の JSON（dict）。候補なしや全て既配信なら "null"。

スコアリング式:
  S = 0.35 * emotion_match
    + 0.25 * keyword_match
    + 0.20 * novelty
    + 0.10 * source_reliability
    + 0.10 * voice_match
    - 1.00 * delivered_before
    - 0.30 * similar_to_last7days
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.parse
from typing import Any

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
SUPABASE_INGEST_KEY = os.environ.get("SUPABASE_INGEST_KEY", "")


def http_get(url: str) -> list[dict[str, Any]]:
    try:
        r = subprocess.run(
            [
                "curl", "-s", "-f", url,
                "-H", f"apikey: {SUPABASE_ANON_KEY}",
                "-H", f"Authorization: Bearer {SUPABASE_ANON_KEY}",
                "-H", f"x-ingest-key: {SUPABASE_INGEST_KEY}",
            ],
            capture_output=True, text=True, timeout=30,
        )
        if r.returncode != 0 or not r.stdout.strip():
            return []
        data = json.loads(r.stdout)
        return data if isinstance(data, list) else []
    except Exception:
        return []


def get_delivered_quote_ids(user_id: str) -> set[str]:
    """過去の全配信履歴から quote_id のセットを取得。"""
    if user_id == "NULL":
        user_filter = "user_id=is.null"
    else:
        user_filter = f"user_id=eq.{user_id}"
    url = f"{SUPABASE_URL}/rest/v1/user_quote_deliveries?select=quote_id,delivery_date&{user_filter}&order=delivery_date.desc&limit=500"
    data = http_get(url)
    return {row["quote_id"] for row in data if row.get("quote_id")}


def get_recent_deliveries(user_id: str) -> list[dict[str, Any]]:
    """直近7日の配信履歴（voice_tags / emotion_tags 類似判定用）。"""
    if user_id == "NULL":
        user_filter = "user_id=is.null"
    else:
        user_filter = f"user_id=eq.{user_id}"
    url = f"{SUPABASE_URL}/rest/v1/user_quote_deliveries?select=delivery_date,quote:quotes(emotion_tags,voice_tags)&{user_filter}&order=delivery_date.desc&limit=7"
    data = http_get(url)
    return data


def compute_score(q: dict[str, Any], themes: dict[str, Any],
                  delivered_ids: set[str], recent_7: list[dict[str, Any]]) -> tuple[float, dict[str, float]]:
    breakdown: dict[str, float] = {}

    # emotion_match
    dominant = (themes.get("dominant_emotion") or {}).get("label", "")
    secondary = (themes.get("secondary_emotion") or {}).get("label", "")
    target_emotions = {e for e in (dominant, secondary) if e}
    quote_emotions = set(q.get("emotion_tags") or [])
    if target_emotions:
        overlap = len(target_emotions & quote_emotions)
        emotion_match = overlap / max(1, len(target_emotions))
    else:
        emotion_match = 0.0
    breakdown["emotion_match"] = emotion_match

    # keyword_match
    keywords = [k.lower() for k in (themes.get("keywords") or []) if k]
    if keywords:
        body_lower = (q.get("body_normalized") or q.get("body") or "").lower()
        hits = sum(1 for kw in keywords if kw in body_lower)
        keyword_match = hits / len(keywords)
    else:
        keyword_match = 0.0
    breakdown["keyword_match"] = keyword_match

    # novelty
    delivered_before = 1.0 if q.get("id") in delivered_ids else 0.0
    novelty = 0.0 if delivered_before else 1.0
    breakdown["novelty"] = novelty

    # source_reliability
    source_reliability = float(q.get("source_reliability") or 0.1)
    breakdown["source_reliability"] = source_reliability

    # voice_match
    needed_voice = themes.get("needed_voice") or ""
    voice_tags = set(q.get("voice_tags") or [])
    voice_match = 1.0 if needed_voice and needed_voice in voice_tags else 0.0
    breakdown["voice_match"] = voice_match

    # similar_to_last7days
    same_count = 0
    for d in recent_7:
        other = d.get("quote") or {}
        o_emotions = set(other.get("emotion_tags") or [])
        o_voice = set(other.get("voice_tags") or [])
        if (quote_emotions & o_emotions) or (voice_tags & o_voice):
            same_count += 1
    similar_to_last7 = min(1.0, same_count / 7.0)
    breakdown["similar_to_last7"] = similar_to_last7
    breakdown["delivered_before"] = delivered_before

    score = (
        0.35 * emotion_match
        + 0.25 * keyword_match
        + 0.20 * novelty
        + 0.10 * source_reliability
        + 0.10 * voice_match
        - 1.00 * delivered_before
        - 0.30 * similar_to_last7
    )
    breakdown["total"] = score
    return score, breakdown


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--themes", required=True, help="JSON string from Step 1")
    parser.add_argument("--user", required=True, help="user_id or 'NULL'")
    args = parser.parse_args()

    try:
        candidates = json.load(sys.stdin)
    except Exception:
        print("null")
        return 0

    if not isinstance(candidates, list) or not candidates:
        print("null")
        return 0

    try:
        themes = json.loads(args.themes)
    except Exception:
        themes = {}

    delivered = get_delivered_quote_ids(args.user)
    recent_7 = get_recent_deliveries(args.user)

    scored: list[tuple[float, dict[str, Any], dict[str, float]]] = []
    for q in candidates:
        score, breakdown = compute_score(q, themes, delivered, recent_7)
        scored.append((score, q, breakdown))

    # タイブレーク: 信頼性 → 日本語 → quality_score → 任意順（安定ソートで index 保持）
    scored.sort(
        key=lambda t: (
            -t[0],
            -float(t[1].get("source_reliability") or 0),
            0 if (t[1].get("body_lang") == "ja") else 1,
            -float(t[1].get("quality_score") or 0),
        )
    )

    best = scored[0]
    score_val, quote_obj, breakdown = best

    # 既配信ペナルティでスコアが大幅マイナスなら候補なし扱い
    if breakdown.get("delivered_before", 0) >= 1.0:
        print("null")
        return 0

    out = {
        "quote_id": quote_obj.get("id"),
        "score": score_val,
        "score_breakdown": breakdown,
    }
    print(json.dumps(out, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
