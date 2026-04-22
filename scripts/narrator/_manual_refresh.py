#!/usr/bin/env python3
"""Manual Refresh (30d): propose updated user_manual card seeds.

Ported from company-dashboard/supabase/functions/narrator-update/index.ts
(runManualRefresh).
"""
from __future__ import annotations

import json
import sys

import _lib

MANUAL_CATEGORY_LABEL = {
    "identity": "私という人",
    "values": "大事にしているもの",
    "joy_trigger": "幸せを感じる瞬間",
    "energy_source": "エネルギーの源",
    "failure_pattern": "つまずきのクセ",
    "recovery_style": "回復のしかた",
    "aspiration": "本当に求めているもの",
}

SYSTEM_PROMPT = """あなたは、ある人の日記・Theme Finder の結果・Roots（人生の棚卸し）を深く読み解き「自分の取扱説明書」の種を書く存在。
その人が自分について読んで「ああ、そうかもしれない」と腑に落ちる1〜2文を、カテゴリごとに生成する。Roots には幼少期から現在までの価値観・家庭環境・転機が含まれるので、それを根拠として織り込む。

## 出力 (JSON)
{
  "identity": { "text": "この人を一言で表すと", "evidence": ["引用1", "引用2"] },
  "values": [{ "text": "価値観カード", "evidence": ["引用"] }],
  "joy_trigger": [{ "text": "幸せを感じる瞬間の傾向", "evidence": ["引用"] }],
  "energy_source": [{ "text": "エネルギーの源", "evidence": ["引用"] }],
  "failure_pattern": [{ "text": "つまずきのクセ", "evidence": ["引用"] }],
  "recovery_style": [{ "text": "回復のしかた", "evidence": ["引用"] }],
  "aspiration": { "text": "本当に求めているもの", "evidence": ["引用"] }
}

## ルール
- 1カードは1〜2文、80字以内
- 「頑張り屋」「努力家」等の汎用ラベルは禁止
- failure_pattern は評価せず観察する語り方で
- evidence は日記 or Roots の生の言葉を短く引用 (20字以内)
- 日本語で、各配列カテゴリは最大2件まで"""


def _resolve_owner_id() -> str | None:
    card = _lib.sb_get_one("user_manual_cards", {
        "select": "user_id", "limit": "1",
    })
    if card and card.get("user_id"):
        return card["user_id"]
    root = _lib.sb_get_one("life_story_entries", {
        "select": "owner_id", "limit": "1",
    })
    if root and root.get("owner_id"):
        return root["owner_id"]
    return None


def run() -> dict:
    owner_id = _resolve_owner_id()
    if not owner_id:
        return {"refreshed": False, "skipped": "no_user"}

    thirty_iso = _lib.iso_days_ago(30)
    recent_count = _lib.sb_count("pending_updates", {
        "owner_id": f"eq.{owner_id}",
        "source": "eq.manual_seed",
        "status": "in.(pending,accepted)",
        "created_at": f"gte.{thirty_iso}",
    })
    if (recent_count or 0) > 0:
        return {"refreshed": False, "skipped": "recent_exists"}

    since_iso = _lib.iso_days_ago(90)
    diaries = _lib.sb_get("diary_entries", {
        "created_at": f"gte.{since_iso}",
        "select": "body,entry_date",
        "order": "created_at.desc",
        "limit": "60",
    }) or []
    themes = _lib.sb_get("story_memory", {
        "memory_type": "in.(identity,emotional_dna,aspirations)",
        "select": "memory_type,narrative_text",
    }) or []
    roots = _lib.sb_get("life_story_entries", {
        "owner_id": f"eq.{owner_id}",
        "select": "stage,axis,question,answer",
        "order": "created_at.desc",
        "limit": "120",
    }) or []
    existing_cards = _lib.sb_get("user_manual_cards", {
        "user_id": f"eq.{owner_id}",
        "archived": "eq.false",
        "select": "id,category,seed_text,user_text,user_edited_at",
    }) or []

    if len(diaries) < 10 and len(roots) == 0:
        return {"refreshed": False, "skipped": "insufficient_data"}

    diary_text = "\n".join(
        f"[{d.get('entry_date')}] {(d.get('body') or '')[:180]}"
        for d in diaries
    )
    theme_text = "\n".join(
        f"{m.get('memory_type')}: {m.get('narrative_text') or ''}"
        for m in themes
    )
    roots_text = "\n".join(
        f"[{e.get('stage')}/{e.get('axis')}] "
        f"Q:{e.get('question')} A:{(e.get('answer') or '')[:160]}"
        for e in roots
    )

    user_msg = (
        f"## 日記 ({len(diaries)}件)\n{diary_text or '(なし)'}\n\n"
        f"## Theme Finder\n{theme_text or 'なし'}\n\n"
        f"## Roots ({len(roots)}件)\n{roots_text or 'まだ未着手'}"
    )

    parsed = _lib.claude_opus_json(SYSTEM_PROMPT, user_msg, timeout_seconds=300)
    if not parsed:
        return {"refreshed": False, "skipped": "llm_failed"}

    by_category: dict[str, list[dict]] = {}

    def push(cat: str, entry) -> None:
        if not entry:
            return
        if isinstance(entry, dict):
            text = entry.get("text")
            if text:
                by_category.setdefault(cat, []).append({
                    "text": text,
                    "evidence": entry.get("evidence"),
                })

    push("identity", parsed.get("identity"))
    for cat in ("values", "joy_trigger", "energy_source",
                "failure_pattern", "recovery_style"):
        for v in parsed.get(cat) or []:
            push(cat, v)
    push("aspiration", parsed.get("aspiration"))

    current_by_cat: dict[str, list[dict]] = {}
    for c in existing_cards:
        current_by_cat.setdefault(c["category"], []).append({
            "id": c["id"],
            "text": c.get("user_text") or c.get("seed_text") or "",
            "user_edited": c.get("user_edited_at") is not None,
        })

    metadata = {
        "diary_count": len(diaries),
        "roots_count": len(roots),
        "generated_at": _lib.iso_now(),
        "triggered_by": "narrator_update_cron",
    }

    rows = []
    for cat, seeds in by_category.items():
        preview = (seeds[0].get("text") or "")[:100] if seeds else None
        rows.append({
            "owner_id": owner_id,
            "source": "manual_seed",
            "category": cat,
            "title": f"{MANUAL_CATEGORY_LABEL.get(cat, cat)} の更新候補",
            "preview": preview,
            "proposed_content": {"seeds": seeds},
            "current_content": {"cards": current_by_cat.get(cat, [])},
            "metadata": metadata,
        })

    if not rows:
        return {"refreshed": False, "skipped": "no_proposals"}

    _lib.sb_insert("pending_updates", rows)
    return {"refreshed": True, "categories": len(rows)}


if __name__ == "__main__":
    _lib.require_env()
    result = run()
    print(json.dumps(result, ensure_ascii=False))
    sys.exit(0)
