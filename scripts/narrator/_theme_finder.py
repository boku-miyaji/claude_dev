#!/usr/bin/env python3
"""Theme Finder (monthly): identity / emotional DNA / aspirations.

Ported from company-dashboard/supabase/functions/narrator-update/index.ts
(runThemeFinder).
"""
from __future__ import annotations

import json
import sys

import _lib

SYSTEM_PROMPT = """長期の日記から人生テーマを発見。

## 沈黙の選択（design-philosophy ⑩）
「前回のテーマ」が提示されている場合、この3ヶ月で identity や志向性に実質的な変化が見られなければ再解釈しない。
月1回のスケジュールに従って機械的に書き直すと、ユーザーの自己理解が AI の言い換えに振り回される。
本当に新しい材料（新しい夢の達成、価値観の転換、感情パターンの明確な変化）があった時だけ更新する。
SILENT 時の出力: {"silent": true}

## 通常の出力
{"identity":"テーマ","emotionalDNA":{"joyTriggers":["3つ"],"energySources":["2-3つ"],"recoveryStyle":"傾向"},"aspirations":"志向1-2文"}"""


def run() -> dict:
    existing = _lib.sb_get_one("story_memory", {
        "memory_type": "eq.identity",
        "select": "updated_at,content,narrative_text",
        "order": "updated_at.desc",
        "limit": "1",
    })

    if existing and _lib.days_since(existing["updated_at"]) < 30:
        return {"updated": False, "reason": "recent"}

    total = _lib.sb_count("diary_entries")
    if total is None or total < 30:
        return {"updated": False, "reason": "insufficient_diary"}

    since_iso = _lib.iso_days_ago(90)
    diaries = _lib.sb_get("diary_entries", {
        "created_at": f"gte.{since_iso}",
        "select": "body,entry_date",
        "order": "created_at.desc",
        "limit": "50",
    }) or []
    dreams = _lib.sb_get("dreams", {
        "status": "in.(active,in_progress,achieved)",
        "select": "title,status",
    }) or []

    diary_text = "\n".join(
        f"[{d.get('entry_date')}] {(d.get('body') or '')[:150]}"
        for d in diaries
    )
    dreams_text = ", ".join(f"{d['title']} ({d['status']})" for d in dreams)

    previous_block = ""
    if existing and existing.get("narrative_text"):
        prev_content = json.dumps(existing.get("content") or {}, ensure_ascii=False)[:400]
        previous_block = (
            f"\n\n## 前回のテーマ ({existing['updated_at'][:10]})\n"
            f"\"{existing['narrative_text']}\"\n前回の詳細: {prev_content}"
        )

    user_msg = (
        f"日記({len(diaries)}件):\n{diary_text}\n\n"
        f"夢: {dreams_text or 'なし'}{previous_block}"
    )

    parsed = _lib.claude_opus_json(SYSTEM_PROMPT, user_msg, timeout_seconds=240)
    if not parsed or parsed.get("silent") or not parsed.get("identity"):
        return {"updated": False, "reason": "silent"}

    updates = [
        ("identity", parsed, parsed.get("identity")),
        ("emotional_dna", parsed.get("emotionalDNA") or {},
         json.dumps(parsed.get("emotionalDNA") or {}, ensure_ascii=False)),
        ("aspirations", {"aspirations": parsed.get("aspirations")},
         parsed.get("aspirations")),
    ]
    now = _lib.iso_now()
    for memory_type, content, narrative in updates:
        existing_row = _lib.sb_get_one("story_memory", {
            "memory_type": f"eq.{memory_type}",
            "select": "id",
            "limit": "1",
        })
        if existing_row:
            _lib.archive_story_memory(existing_row["id"], memory_type, "theme_finder_cron")
            _lib.sb_update("story_memory", {"id": f"eq.{existing_row['id']}"}, {
                "content": content,
                "narrative_text": narrative,
                "updated_at": now,
            })
        else:
            _lib.sb_insert("story_memory", {
                "memory_type": memory_type,
                "content": content,
                "narrative_text": narrative,
            })

    return {"updated": True, "identity": parsed.get("identity")}


if __name__ == "__main__":
    _lib.require_env()
    result = run()
    print(json.dumps(result, ensure_ascii=False))
    sys.exit(0)
