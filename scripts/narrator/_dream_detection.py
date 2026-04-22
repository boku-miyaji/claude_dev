#!/usr/bin/env python3
"""Dream Detection (weekly): scan recent diaries against active dreams.

Ported from company-dashboard/supabase/functions/narrator-update/index.ts
(runDreamDetection).
"""
from __future__ import annotations

import json
import sys

import _lib

SYSTEM_PROMPT = """ユーザーの過去1週間の日記と夢リストを照合し、達成・進捗に近づいた気づきを検出してください。
過剰検出は避ける。confidence が medium 以上のみ返す。
出力JSON: { "detections": [{ "diary_id": number, "dream_id": number, "confidence": "high"|"medium", "reason": "日記の具体的な表現を引用して理由(1-2文)" }] }
該当なしは detections:[] で返す。"""


def run() -> dict:
    last_run = _lib.sb_get_one("activity_log", {
        "action": "eq.dream_detection_weekly",
        "select": "created_at",
        "order": "created_at.desc",
        "limit": "1",
    })
    if last_run and _lib.days_since(last_run["created_at"]) < 7:
        return {"detected": 0, "skipped": True}

    dreams = _lib.sb_get("dreams", {
        "status": "in.(active,in_progress)",
        "select": "id,title,description",
    }) or []
    if not dreams:
        return {"detected": 0, "reason": "no_active_dreams"}

    since_iso = _lib.iso_days_ago(7)
    diaries = _lib.sb_get("diary_entries", {
        "created_at": f"gte.{since_iso}",
        "select": "id,body,entry_date,created_at",
        "order": "created_at.desc",
        "limit": "30",
    }) or []
    if not diaries:
        return {"detected": 0, "reason": "no_recent_diaries"}

    dream_list = "\n".join(
        f"- ID:{d['id']} \"{d['title']}\"" +
        (f" ({d['description']})" if d.get("description") else "")
        for d in dreams
    )
    diary_text = "\n\n".join(
        f"[diary_id={d['id']}, {d.get('entry_date')}] {(d.get('body') or '')[:300]}"
        for d in diaries
    )

    user_msg = f"## 日記\n{diary_text}\n\n## 夢リスト\n{dream_list}"

    parsed = _lib.claude_opus_json(SYSTEM_PROMPT, user_msg, timeout_seconds=240)
    detections = []
    if parsed and isinstance(parsed.get("detections"), list):
        detections = parsed["detections"]

    dream_by_id = {d["id"]: d for d in dreams}
    filtered = [
        d for d in detections
        if d.get("confidence") in ("high", "medium")
        and d.get("dream_id") in dream_by_id
    ]

    if filtered:
        rows = []
        for d in filtered:
            dream = dream_by_id.get(d["dream_id"])
            rows.append({
                "action": "dream_detected",
                "description": (
                    f"「{dream['title'] if dream else 'Dream'}」に近づいた気づき: "
                    f"{d.get('reason', '')}"
                ),
                "metadata": {**d, "dream_title": dream["title"] if dream else None},
            })
        _lib.sb_insert("activity_log", rows)

    _lib.sb_insert("activity_log", {
        "action": "dream_detection_weekly",
        "description": f"Weekly dream scan: {len(filtered)} detection(s)",
        "metadata": {
            "detected": len(filtered),
            "diaries": len(diaries),
            "dreams": len(dreams),
        },
    })

    return {"detected": len(filtered)}


if __name__ == "__main__":
    _lib.require_env()
    result = run()
    print(json.dumps(result, ensure_ascii=False))
    sys.exit(0)
