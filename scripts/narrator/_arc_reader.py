#!/usr/bin/env python3
"""Arc Reader (daily): detect the user's current emotional phase.

Ported from company-dashboard/supabase/functions/narrator-update/index.ts
(runArcReader). Runs via Claude CLI on GitHub Actions (flat-rate).
"""
from __future__ import annotations

import json
import sys

import _lib

PLUTCHIK = ("joy", "trust", "fear", "surprise", "sadness", "disgust",
            "anger", "anticipation")

SYSTEM_PROMPT = """感情データと日記の内容から、この人が今どんな時期にいるかを判定する。
narrativeは友達が「最近どう？」と聞かれて答えるくらいの自然な日本語で、具体的な出来事や気持ちに触れて1-2文で書く。
抽象的・詩的な表現は禁止（×「大きな扉を開けた」「キラリと見えてきた」）。日記の内容に基づいた具体的な事実を述べる。

## 沈黙の選択（design-philosophy ⑩）
「前回の解釈」が提示されている場合、前回と実質同じ状態（同じフェーズ・同じ文脈で前回の narrative でも通用する）なら、再解釈せず SILENT を返す。
週次の定期実行に従って機械的に書き直すと、ユーザーから見ると AI の過剰介入になる。本当に変化があった時だけ新しい narrative を書く。
SILENT 時の出力: {"phase": null, "narrative": "SILENT", "confidence": 0}

## 通常の出力
{"phase":"exploration|immersion|reflection|reconstruction|leap","narrative":"1-2文の具体的な説明","confidence":0.0-1.0}"""


def run() -> dict:
    existing = _lib.sb_get_one("story_memory", {
        "memory_type": "eq.current_arc",
        "select": "id,updated_at,narrative_text",
        "order": "updated_at.desc",
        "limit": "1",
    })

    if existing and _lib.days_since(existing["updated_at"]) < 1:
        return {"updated": False, "reason": "recent"}

    since_iso = _lib.iso_days_ago(14)
    emotions = _lib.sb_get("emotion_analysis", {
        "created_at": f"gte.{since_iso}",
        "select": "joy,trust,fear,surprise,sadness,disgust,anger,anticipation,valence,arousal,wbi_score,created_at",
        "order": "created_at.asc",
    }) or []

    if len(emotions) < 3:
        return {"updated": False, "reason": "too_few_emotions"}

    diaries = _lib.sb_get("diary_entries", {
        "created_at": f"gte.{since_iso}",
        "select": "body,created_at",
        "order": "created_at.asc",
        "limit": "10",
    }) or []

    timeline = []
    for e in emotions:
        dominant, max_val = "joy", 0.0
        for k in PLUTCHIK:
            v = float(e.get(k) or 0)
            if v > max_val:
                max_val, dominant = v, k
        timeline.append({
            "date": (e.get("created_at") or "")[:10],
            "dominant": dominant,
            "wbi": e.get("wbi_score"),
            "valence": e.get("valence"),
            "arousal": e.get("arousal"),
        })

    diary_text = "\n".join(
        f"[{(d.get('created_at') or '')[:10]}] {(d.get('body') or '')[:120]}"
        for d in diaries
    )
    previous_block = ""
    if existing and existing.get("narrative_text"):
        previous_block = (
            f"\n\n## 前回の解釈 ({existing['updated_at'][:10]})\n"
            f"\"{existing['narrative_text']}\""
        )

    user_msg = (
        f"感情:\n{json.dumps(timeline, ensure_ascii=False)}\n\n"
        f"日記:\n{diary_text}{previous_block}"
    )

    parsed = _lib.claude_opus_json(SYSTEM_PROMPT, user_msg, timeout_seconds=180)
    if not parsed or not parsed.get("phase") or parsed.get("narrative") == "SILENT":
        return {"updated": False, "reason": "silent"}

    patch = {
        "content": parsed,
        "narrative_text": parsed.get("narrative"),
        "updated_at": _lib.iso_now(),
    }
    if existing:
        _lib.archive_story_memory(existing["id"], "current_arc", "arc_reader_cron")
        _lib.sb_update("story_memory", {"id": f"eq.{existing['id']}"}, patch)
    else:
        _lib.sb_insert("story_memory", {
            "memory_type": "current_arc",
            "content": parsed,
            "narrative_text": parsed.get("narrative"),
        })

    return {"updated": True, "phase": parsed.get("phase")}


if __name__ == "__main__":
    _lib.require_env()
    result = run()
    print(json.dumps(result, ensure_ascii=False))
    sys.exit(0)
