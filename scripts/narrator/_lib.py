#!/usr/bin/env python3
"""Shared helpers for narrator-update CLI batch.

Supabase REST + Claude CLI invoker. Mirrors the behavior of
company-dashboard/supabase/functions/narrator-update/index.ts, but runs
on GitHub Actions with Claude Code CLI (Opus) on the flat-rate plan.
"""
from __future__ import annotations

import datetime as _dt
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_INGEST_KEY = os.environ.get("SUPABASE_INGEST_KEY", "")

# Mapping: app_config value (API model ID) → Claude CLI shortname
_MODEL_CLI_MAP: dict[str, str] = {
    "claude-opus-4-7":          "opus",
    "claude-sonnet-4-6":        "sonnet",
    "claude-haiku-4-5-20251001": "haiku",
}

_config_cache: dict[str, str] = {}


def _auth_headers() -> dict[str, str]:
    """Prefer service-role for write-heavy batch; fall back to anon + ingest-key."""
    if SUPABASE_SERVICE_ROLE_KEY:
        return {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        }
    h = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    }
    if SUPABASE_INGEST_KEY:
        h["x-ingest-key"] = SUPABASE_INGEST_KEY
    return h


def _req(method: str, path: str, params: dict | None = None,
         body: Any = None, extra_headers: dict | None = None) -> tuple[int, str]:
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params, doseq=True)
    headers = _auth_headers()
    if body is not None:
        headers["Content-Type"] = "application/json"
    if extra_headers:
        headers.update(extra_headers)
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return res.status, res.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")[:500]
    except Exception as e:  # noqa: BLE001
        return 0, f"exception: {e}"


def sb_get(path: str, params: dict | None = None) -> list | None:
    code, body = _req("GET", path, params=params)
    if 200 <= code < 300:
        try:
            return json.loads(body)
        except json.JSONDecodeError:
            return None
    sys.stderr.write(f"[narrator] sb_get {path} -> {code}: {body[:200]}\n")
    return None


def sb_get_one(path: str, params: dict | None = None) -> dict | None:
    rows = sb_get(path, params)
    if isinstance(rows, list) and rows:
        return rows[0]
    return None


def sb_count(path: str, params: dict | None = None) -> int | None:
    hdrs = {"Prefer": "count=exact"}
    p = dict(params or {})
    p["select"] = "id"
    p["limit"] = "1"
    url = f"{SUPABASE_URL}/rest/v1/{path}?" + urllib.parse.urlencode(p, doseq=True)
    req = urllib.request.Request(url, headers={**_auth_headers(), **hdrs}, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            content_range = res.headers.get("content-range", "")
            if "/" in content_range:
                return int(content_range.split("/")[-1])
            return None
    except Exception:  # noqa: BLE001
        return None


def sb_insert(path: str, rows: list | dict) -> bool:
    code, body = _req("POST", path, body=rows,
                      extra_headers={"Prefer": "return=minimal"})
    if 200 <= code < 300:
        return True
    sys.stderr.write(f"[narrator] sb_insert {path} -> {code}: {body[:200]}\n")
    return False


def sb_update(path: str, filter_params: dict, patch: dict) -> bool:
    code, body = _req("PATCH", path, params=filter_params, body=patch,
                      extra_headers={"Prefer": "return=minimal"})
    if 200 <= code < 300:
        return True
    sys.stderr.write(f"[narrator] sb_update {path} -> {code}: {body[:200]}\n")
    return False


def get_app_config(key: str, default: str = "") -> str:
    """Read a value from the app_config table, with in-process caching."""
    if key in _config_cache:
        return _config_cache[key]
    row = sb_get_one("app_config", {"key": f"eq.{key}", "select": "value"})
    val = (row or {}).get("value") or default
    _config_cache[key] = val
    return val


def claude_opus_json(system_prompt: str, user_message: str,
                     timeout_seconds: int = 180,
                     config_key: str = "batch.narrator_model") -> dict | None:
    """Invoke claude CLI and parse the first JSON object from stdout.

    Model is read from app_config (config_key), defaulting to claude-opus-4-7.
    Matches the original Edge Function's llmJson() contract. Returns None on
    any failure so callers can skip gracefully.
    """
    model_id = get_app_config(config_key, "claude-opus-4-7")
    cli_model = _MODEL_CLI_MAP.get(model_id, "opus")
    prompt = (
        f"{system_prompt}\n\n"
        "必ず JSON オブジェクトのみを返してください。前後に説明文を付けない。\n\n"
        f"{user_message}"
    )
    try:
        r = subprocess.run(
            ["claude", "--print", "--model", cli_model],
            input=prompt,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
        )
    except subprocess.TimeoutExpired:
        sys.stderr.write("[narrator] claude CLI timeout\n")
        return None
    except FileNotFoundError:
        sys.stderr.write("[narrator] claude CLI not found on PATH\n")
        return None
    if r.returncode != 0:
        sys.stderr.write(f"[narrator] claude exit={r.returncode}: {r.stderr[:300]}\n")
        return None
    m = re.search(r"\{[\s\S]*\}", r.stdout)
    if not m:
        sys.stderr.write(f"[narrator] no JSON in response: {r.stdout[:200]}\n")
        return None
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError as e:
        sys.stderr.write(f"[narrator] JSON parse failed: {e}\n")
        return None


def archive_story_memory(row_id: int, memory_type: str, reason: str) -> None:
    """Snapshot a story_memory row into story_memory_archive before UPDATE.

    design-philosophy ③: append-only. Failures are logged but non-fatal.
    """
    current = sb_get_one("story_memory", {
        "id": f"eq.{row_id}",
        "select": "id,memory_type,content,narrative_text,version,created_at,updated_at",
    })
    if not current:
        return
    archive = {
        "original_id": current["id"],
        "memory_type": current["memory_type"],
        "content": current["content"],
        "narrative_text": current["narrative_text"],
        "version": current.get("version"),
        "original_created_at": current["created_at"],
        "original_updated_at": current["updated_at"],
        "archive_reason": reason,
    }
    try:
        sb_insert("story_memory_archive", archive)
    except Exception as e:  # noqa: BLE001
        sys.stderr.write(f"[narrator] archive {memory_type} failed: {e}\n")


def days_since(iso_ts: str) -> float:
    dt = _dt.datetime.fromisoformat(iso_ts.replace("Z", "+00:00"))
    delta = _dt.datetime.now(_dt.timezone.utc) - dt
    return delta.total_seconds() / 86400.0


def iso_days_ago(n: int) -> str:
    return (_dt.datetime.now(_dt.timezone.utc) - _dt.timedelta(days=n)).isoformat()


def iso_now() -> str:
    return _dt.datetime.now(_dt.timezone.utc).isoformat()


def log_activity(action: str, description: str, metadata: dict | None = None) -> None:
    """Best-effort write to activity_log. Never raises."""
    try:
        sb_insert("activity_log", {
            "action": action,
            "description": description,
            "metadata": metadata or {},
        })
    except Exception:  # noqa: BLE001
        pass


def require_env() -> None:
    if not SUPABASE_URL:
        sys.stderr.write("SUPABASE_URL required\n")
        sys.exit(1)
    if not (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY):
        sys.stderr.write("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY required\n")
        sys.exit(1)
