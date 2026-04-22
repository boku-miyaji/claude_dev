#!/usr/bin/env python3
"""Chapter Generator (quarterly): create a narrative chapter for the quarter.

Ported from company-dashboard/supabase/functions/narrator-update/index.ts
(runChapterGenerator).
"""
from __future__ import annotations

import datetime as _dt
import json
import sys

import _lib

SYSTEM_PROMPT = (
    '四半期の日記と転機から「章」を生成。'
    '出力JSON: {"title":"章タイトル(5語以内)","summary":"この期間の要約(3-4文)",'
    '"emotional_journey":"感情の旅路(2文)","learnings":"学んだこと(2文)"}'
)


def _quarter_start_iso() -> str:
    now = _dt.datetime.now(_dt.timezone.utc)
    q_month = (now.month - 1) // 3 * 3 + 1
    qs = now.replace(month=q_month, day=1, hour=0, minute=0,
                     second=0, microsecond=0)
    return qs.isoformat()


def run() -> dict:
    qs_iso = _quarter_start_iso()

    existing = _lib.sb_get_one("story_memory", {
        "memory_type": "eq.chapter",
        "created_at": f"gte.{qs_iso}",
        "select": "id",
        "limit": "1",
    })
    if existing:
        return {"created": False, "reason": "already_this_quarter"}

    total_this_quarter = _lib.sb_count("diary_entries", {
        "created_at": f"gte.{qs_iso}",
    })
    if total_this_quarter is None or total_this_quarter < 15:
        return {"created": False, "reason": "insufficient_diary"}

    diaries = _lib.sb_get("diary_entries", {
        "created_at": f"gte.{qs_iso}",
        "select": "body,entry_date,wbi",
        "order": "created_at.asc",
        "limit": "50",
    }) or []
    moments = _lib.sb_get("story_moments", {
        "detected_at": f"gte.{qs_iso}",
        "user_confirmed": "eq.true",
        "select": "moment_type,title,description,detected_at",
    }) or []

    diary_text = "\n".join(
        f"[{d.get('entry_date')}] {(d.get('body') or '')[:100]}"
        for d in diaries
    )
    moments_text = "\n".join(
        f"[{m.get('moment_type')}] {m.get('title')}: {m.get('description')}"
        for m in moments
    )

    user_msg = (
        f"日記({len(diaries)}件):\n{diary_text}\n\n"
        f"転機:\n{moments_text or 'なし'}"
    )

    parsed = _lib.claude_opus_json(SYSTEM_PROMPT, user_msg, timeout_seconds=180)
    if not parsed or not parsed.get("title"):
        return {"created": False, "reason": "llm_failed"}

    _lib.sb_insert("story_memory", {
        "memory_type": "chapter",
        "content": parsed,
        "narrative_text": f"{parsed['title']}: {parsed.get('summary', '')}",
    })

    return {"created": True, "title": parsed.get("title")}


if __name__ == "__main__":
    _lib.require_env()
    result = run()
    print(json.dumps(result, ensure_ascii=False))
    sys.exit(0)
