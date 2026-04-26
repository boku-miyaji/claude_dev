#!/usr/bin/env python3
"""
_detect_kind.py — 4種の前奏 kind のうちどれを発火するかを semi-formal premise で評価する。

入力 (CLI args):
  --user <USER_ID>     "NULL" または UUID
  --date <YYYY-MM-DD>  対象日（JST）

出力 (stdout, JSON):
  シグナルが立てば:
    {
      "kind": "silence_acknowledge" | "gentle_prelude" | "pattern_echo" | "schedule_softener",
      "delivery_date": "YYYY-MM-DD",
      "user_id": "NULL" | "UUID",
      "premise": {
        "signals": [...],
        "explicit_premise": [...]
      },
      "trace": {
        "references": [...],
        "reasoning_steps": [...]
      },
      "context": {
        "recent_diary_excerpt": "...",  -- 本文生成側に渡す素材
        "calendar_density": int,
        "last_diary_date": "YYYY-MM-DD" or null
      }
    }
  立たなければ:
    {}

判定ロジック (semi-formal):
  P1. 最終 diary_entry_date と DATE の差を sn_days とする
  P2. 当日の calendar_events を密度（件数）で測る
  P3. 直近 14日の diary topics と前日の topics の jaccard を score にする

  R1. sn_days >= 2 → "silence_acknowledge"
  R2. else if calendar_density >= 4 → "schedule_softener"
  R3. else if pattern_score >= 0.4 (and 前日の diary あり) → "pattern_echo"
  R4. else if 前日の diary 本文 >= 20 chars → "gentle_prelude"
  R5. otherwise → silent (return {})
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from urllib.parse import quote
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

JST = timezone(timedelta(hours=9))


def _env(name: str) -> str:
    val = os.environ.get(name)
    if not val:
        print(f"[detect_kind] missing env: {name}", file=sys.stderr)
        sys.exit(1)
    return val


def _read_key() -> str:
    return os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or _env("SUPABASE_ANON_KEY")


def _supabase_get(path: str) -> list:
    """Supabase REST GET（service role 優先で RLS 迂回）"""
    url = f"{_env('SUPABASE_URL')}/rest/v1/{path}"
    key = _read_key()
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "x-ingest-key": _env("SUPABASE_INGEST_KEY"),
    }
    try:
        req = Request(url, headers=headers, method="GET")
        with urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except (HTTPError, URLError, json.JSONDecodeError) as e:
        print(f"[detect_kind] supabase GET failed: {path} {e}", file=sys.stderr)
        return []


def _user_filter(user_id: str) -> str:
    return "user_id=is.null" if user_id == "NULL" else f"user_id=eq.{user_id}"


def _last_diary(user_id: str, before_date: str) -> dict | None:
    q = (
        f"diary_entries?{_user_filter(user_id)}"
        f"&entry_date=lt.{before_date}"
        f"&order=entry_date.desc&limit=1"
        f"&select=id,entry_date,body,topics,wbi"
    )
    rows = _supabase_get(q)
    return rows[0] if rows else None


def _yesterday_diary(user_id: str, date: str) -> dict | None:
    yesterday = (datetime.fromisoformat(date) - timedelta(days=1)).date().isoformat()
    q = (
        f"diary_entries?{_user_filter(user_id)}"
        f"&entry_date=eq.{yesterday}"
        f"&order=updated_at.desc&limit=1"
        f"&select=id,entry_date,body,ai_summary,topics,wbi"
    )
    rows = _supabase_get(q)
    return rows[0] if rows else None


def _recent_diary_topics(user_id: str, date: str, days: int = 14) -> list[dict]:
    start = (datetime.fromisoformat(date) - timedelta(days=days)).date().isoformat()
    end = date
    q = (
        f"diary_entries?{_user_filter(user_id)}"
        f"&entry_date=gte.{start}&entry_date=lt.{end}"
        f"&order=entry_date.desc&limit=14"
        f"&select=id,entry_date,topics"
    )
    return _supabase_get(q)


def _calendar_density(user_id: str, date: str) -> int:
    start = f"{date}T00:00:00+09:00"
    end_dt = datetime.fromisoformat(date) + timedelta(days=1)
    end = end_dt.strftime("%Y-%m-%dT00:00:00+09:00")
    q = (
        f"calendar_events?start_time=gte.{quote(start)}"
        f"&start_time=lt.{quote(end)}&select=id"
    )
    rows = _supabase_get(q)
    return len(rows)


def _topics_set(diary: dict | None) -> set[str]:
    if not diary:
        return set()
    topics = diary.get("topics") or []
    if isinstance(topics, list):
        return {str(t).strip().lower() for t in topics if str(t).strip()}
    return set()


def _pattern_score(yesterday_diary: dict | None, recent: list[dict]) -> tuple[float, dict | None]:
    """前日の topics と直近の各日の topics の最大 jaccard 類似度を返す"""
    y_topics = _topics_set(yesterday_diary)
    if not y_topics:
        return 0.0, None
    best = 0.0
    best_ref = None
    for entry in recent:
        if yesterday_diary and entry.get("id") == yesterday_diary.get("id"):
            continue
        e_topics = _topics_set(entry)
        if not e_topics:
            continue
        inter = len(y_topics & e_topics)
        union = len(y_topics | e_topics)
        if union == 0:
            continue
        jacc = inter / union
        if jacc > best:
            best = jacc
            best_ref = entry
    return best, best_ref


def _excerpt(text: str | None, limit: int = 240) -> str:
    if not text:
        return ""
    text = text.replace("\r", " ").strip()
    return text if len(text) <= limit else text[:limit] + "…"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--user", required=True)
    parser.add_argument("--date", required=True)
    args = parser.parse_args()

    user_id = args.user
    date = args.date

    last_diary = _last_diary(user_id, date)
    yesterday_diary = _yesterday_diary(user_id, date)
    recent = _recent_diary_topics(user_id, date, days=14)
    cal_density = _calendar_density(user_id, date)

    today_dt = datetime.fromisoformat(date).date()
    sn_days = None
    if last_diary and last_diary.get("entry_date"):
        last_dt = datetime.fromisoformat(last_diary["entry_date"]).date()
        sn_days = (today_dt - last_dt).days

    p_score, p_ref = _pattern_score(yesterday_diary, recent)

    # semi-formal premise
    explicit_premise = [
        f"sn_days = {sn_days if sn_days is not None else 'unknown (no diary on record)'}",
        f"calendar_density(today) = {cal_density}",
        f"yesterday_diary_present = {bool(yesterday_diary)}",
        f"pattern_score(yesterday vs last 14d) = {p_score:.2f}",
    ]

    signals: list[str] = []
    references: list[dict] = []
    reasoning_steps: list[str] = []

    decision: dict = {
        "kind": None,
        "delivery_date": date,
        "user_id": user_id,
        "premise": {"signals": signals, "explicit_premise": explicit_premise},
        "trace": {"references": references, "reasoning_steps": reasoning_steps},
        "context": {
            "recent_diary_excerpt": _excerpt(
                (yesterday_diary or {}).get("ai_summary") or (yesterday_diary or {}).get("body")
            ),
            "calendar_density": cal_density,
            "last_diary_date": (last_diary or {}).get("entry_date"),
            "yesterday_topics": list(_topics_set(yesterday_diary)),
        },
    }

    # R1: 沈黙 ≥ 2日
    if sn_days is not None and sn_days >= 2:
        signals.append("silence_gap_2plus_days")
        reasoning_steps.append(
            f"R1 fires: sn_days={sn_days} >= 2 → silence_acknowledge"
        )
        if last_diary:
            references.append({"kind": "diary_entry", "id": last_diary.get("id"), "entry_date": last_diary.get("entry_date")})
        decision["kind"] = "silence_acknowledge"
    # R2: スケジュール詰まり
    elif cal_density >= 4:
        signals.append("calendar_density_4plus")
        reasoning_steps.append(
            f"R2 fires: calendar_density={cal_density} >= 4 → schedule_softener"
        )
        decision["kind"] = "schedule_softener"
    # R3: パターン再来
    elif p_score >= 0.4 and yesterday_diary:
        signals.append("pattern_recurrence_jaccard_0_4plus")
        reasoning_steps.append(
            f"R3 fires: jaccard={p_score:.2f} >= 0.4 → pattern_echo"
        )
        if p_ref:
            references.append({"kind": "diary_entry", "id": p_ref.get("id"), "entry_date": p_ref.get("entry_date"), "role": "echo_source"})
        if yesterday_diary:
            references.append({"kind": "diary_entry", "id": yesterday_diary.get("id"), "entry_date": yesterday_diary.get("entry_date"), "role": "current"})
        decision["kind"] = "pattern_echo"
    # R4: 前夜の日記から穏やかな前奏
    elif yesterday_diary and len((yesterday_diary.get("body") or "").strip()) >= 20:
        signals.append("yesterday_diary_present")
        reasoning_steps.append(
            "R4 fires: yesterday diary >= 20 chars → gentle_prelude"
        )
        references.append({"kind": "diary_entry", "id": yesterday_diary.get("id"), "entry_date": yesterday_diary.get("entry_date")})
        decision["kind"] = "gentle_prelude"
    # R5: 何もしない
    else:
        reasoning_steps.append("no rule fires → silent")
        json.dump({}, sys.stdout, ensure_ascii=False)
        return 0

    json.dump(decision, sys.stdout, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
