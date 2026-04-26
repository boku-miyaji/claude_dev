#!/usr/bin/env python3
"""
_insert_preparation.py — proactive_preparations + agent_sessions(audit) に書き込む。

Args:
  --decision <JSON>  _detect_kind.py の出力
  --prelude  <JSON>  _generate_prelude.sh の出力 ({body, hint, conclusion})
  --user     <USER_ID>
  --date     <YYYY-MM-DD>

冪等性:
  - proactive_preparations は UNIQUE(user_id, delivery_date) 違反時 PostgREST 409 を返す
  - 既に存在する場合は audit log だけ追記して exit 0 にする

audit log:
  - agent_sessions に event_type='proactive_intervention' で記録
  - session_id は CLAUDE_SESSION_ID env or `proactive-prep-{date}-{user_short}`
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import uuid
from urllib.request import Request, urlopen
from urllib.error import HTTPError


def _env(name: str) -> str:
    val = os.environ.get(name)
    if not val:
        print(f"[insert_preparation] missing env: {name}", file=sys.stderr)
        sys.exit(1)
    return val


def _post(path: str, body: dict, *, prefer: str = "return=representation") -> tuple[int, str]:
    url = f"{_env('SUPABASE_URL')}/rest/v1/{path}"
    payload = json.dumps(body).encode("utf-8")
    headers = {
        "apikey": _env("SUPABASE_ANON_KEY"),
        "Authorization": f"Bearer {_env('SUPABASE_ANON_KEY')}",
        "Content-Type": "application/json",
        "x-ingest-key": _env("SUPABASE_INGEST_KEY"),
        "Prefer": prefer,
    }
    req = Request(url, headers=headers, data=payload, method="POST")
    try:
        with urlopen(req, timeout=15) as resp:
            return resp.status, resp.read().decode("utf-8")
    except HTTPError as e:
        return e.code, e.read().decode("utf-8") if hasattr(e, "read") else str(e)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--decision", required=True)
    parser.add_argument("--prelude", required=True)
    parser.add_argument("--user", required=True)
    parser.add_argument("--date", required=True)
    args = parser.parse_args()

    decision = json.loads(args.decision)
    prelude = json.loads(args.prelude)

    kind = decision.get("kind")
    if not kind:
        print("[insert_preparation] no kind, abort")
        return 0

    body = (prelude.get("body") or "").strip()
    if not body:
        print("[insert_preparation] empty body, abort")
        return 0

    user_id = args.user
    user_id_field = None if user_id == "NULL" else user_id

    event_id = str(uuid.uuid4())

    prep_payload = {
        "user_id": user_id_field,
        "delivery_date": args.date,
        "kind": kind,
        "body": body,
        "hint": prelude.get("hint"),
        "premise": decision.get("premise") or {},
        "trace": decision.get("trace") or {},
        "conclusion": (prelude.get("conclusion") or "").strip() or kind,
        "source": "batch",
        "status": "ready",
        "agent_session_event_id": event_id,
    }

    status, resp = _post("proactive_preparations", prep_payload)

    if status == 201:
        print(f"[insert_preparation] inserted: kind={kind}, date={args.date}")
    elif status == 409:
        # UNIQUE 違反 = 既に当日分あり。audit だけ残す
        print(f"[insert_preparation] already exists for date={args.date}, skip insert")
    else:
        print(f"[insert_preparation] insert failed: status={status} body={resp[:200]}", file=sys.stderr)

    # ============================================================
    # audit log: agent_sessions
    # ============================================================
    short_user = (user_id_field or "single")[:8]
    session_id = os.environ.get("CLAUDE_SESSION_ID") or f"proactive-prep-{args.date}-{short_user}"

    audit_payload = {
        "session_id": session_id,
        "event_type": "proactive_intervention",
        "dept": "proactive-prep",
        "payload": {
            "preparation_event_id": event_id,
            "kind": kind,
            "delivery_date": args.date,
            "premise": decision.get("premise") or {},
            "trace": decision.get("trace") or {},
            "conclusion": (prelude.get("conclusion") or "").strip() or kind,
            "rendered": {"body": body, "hint": prelude.get("hint")},
            "source": "scripts/proactive-prep",
        },
    }
    a_status, a_resp = _post("agent_sessions", audit_payload)
    if a_status not in (200, 201):
        print(f"[insert_preparation] audit log insert non-2xx: status={a_status} body={a_resp[:200]}", file=sys.stderr)
    else:
        print(f"[insert_preparation] audit logged session={session_id} event={event_id}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
