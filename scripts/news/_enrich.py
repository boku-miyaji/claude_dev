#!/usr/bin/env python3
"""News enrichment via Claude CLI (Opus).

For each news_items row where enriched_at IS NULL:
  1. Fetch URL and extract main text
  2. Ask Claude CLI for {title_ja, summary} as JSON
  3. UPDATE news_items

Failures still bump enriched_at so we never retry-loop forever.

Env mirrors scripts/news/enrich.sh.
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

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_INGEST_KEY = os.environ.get("SUPABASE_INGEST_KEY", "")

BATCH_LIMIT = int(os.environ.get("NEWS_ENRICH_LIMIT", "20"))
CLAUDE_TIMEOUT = int(os.environ.get("NEWS_ENRICH_TIMEOUT", "180"))
FETCH_TIMEOUT_SECONDS = 8
MAX_CONTENT_CHARS = 3000


def _auth_headers() -> dict[str, str]:
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


def sb_select_rows() -> list[dict]:
    params = {
        "select": "id,title,url,summary,source_type",
        "enriched_at": "is.null",
        "order": "collected_at.desc",
        "limit": str(BATCH_LIMIT),
    }
    url = f"{SUPABASE_URL}/rest/v1/news_items?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=_auth_headers(), method="GET")
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return json.loads(res.read().decode("utf-8")) or []
    except urllib.error.HTTPError as e:
        sys.stderr.write(f"[news-enrich] select error {e.code}: {e.read().decode('utf-8')[:200]}\n")
        return []


def sb_update_row(row_id: int, patch: dict) -> bool:
    url = f"{SUPABASE_URL}/rest/v1/news_items?id=eq.{row_id}"
    data = json.dumps(patch).encode("utf-8")
    headers = {**_auth_headers(),
               "Content-Type": "application/json",
               "Prefer": "return=minimal"}
    req = urllib.request.Request(url, data=data, headers=headers, method="PATCH")
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return 200 <= res.status < 300
    except urllib.error.HTTPError as e:
        sys.stderr.write(f"[news-enrich] UPDATE id={row_id} failed {e.code}: {e.read().decode('utf-8')[:200]}\n")
        return False


def extract_main_text(html: str) -> str:
    # strip noisy tags
    t = re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.IGNORECASE)
    t = re.sub(r"<style[\s\S]*?</style>", " ", t, flags=re.IGNORECASE)
    t = re.sub(r"<svg[\s\S]*?</svg>", " ", t, flags=re.IGNORECASE)
    t = re.sub(r"<noscript[\s\S]*?</noscript>", " ", t, flags=re.IGNORECASE)

    # prefer <article> or <main>
    article = re.search(r"<article[\s\S]*?</article>", t, flags=re.IGNORECASE)
    main = re.search(r"<main[\s\S]*?</main>", t, flags=re.IGNORECASE)
    core = (article or main).group(0) if (article or main) else t

    core = re.sub(r"<[^>]+>", " ", core)
    core = (core.replace("&nbsp;", " ")
                .replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&quot;", '"')
                .replace("&#39;", "'"))
    core = re.sub(r"\s+", " ", core).strip()
    return core[:MAX_CONTENT_CHARS]


def fetch_url_content(url: str) -> str | None:
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (compatible; FocusYou-NewsBot/1.0)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        })
        with urllib.request.urlopen(req, timeout=FETCH_TIMEOUT_SECONDS) as res:
            ct = res.headers.get("Content-Type", "")
            if "html" not in ct and "text" not in ct:
                return None
            html = res.read().decode("utf-8", errors="replace")
            return extract_main_text(html)
    except Exception:  # noqa: BLE001
        return None


PROMPT_TEMPLATE = """以下の記事を読んで、JSONで以下を返してください:
{{
  "title_ja": "タイトルを日本語で簡潔に（30字以内）",
  "summary": "2〜3文の日本語要約。何が起きたか/何が重要か/どう使えるかのうち、読んで得られる中身を伝える。記事を開く前に価値判断できる内容にする。数値・固有名詞があれば含める。"
}}

- 英語の記事は必ず日本語に翻訳する
- 煽りや「〜は必見！」などは不要
- JSON以外は返さない

{source}"""


def summarize(title: str, content: str | None) -> dict | None:
    if content and len(content) > 40:
        source = f"タイトル: {title}\n\n記事本文:\n{content}"
    else:
        source = f"タイトル: {title}"

    prompt = (
        "あなたは技術記事の日本語要約アシスタントです。"
        "正確で簡潔な日本語で要約します。\n\n"
        + PROMPT_TEMPLATE.format(source=source)
    )
    try:
        r = subprocess.run(
            ["claude", "--print", "--model", "opus"],
            input=prompt,
            capture_output=True,
            text=True,
            timeout=CLAUDE_TIMEOUT,
        )
    except subprocess.TimeoutExpired:
        sys.stderr.write(f"[news-enrich] claude timeout for title={title[:80]}\n")
        return None
    if r.returncode != 0:
        sys.stderr.write(f"[news-enrich] claude exit={r.returncode}: {r.stderr[:200]}\n")
        return None
    m = re.search(r"\{[\s\S]*\}", r.stdout)
    if not m:
        sys.stderr.write(f"[news-enrich] no JSON in response: {r.stdout[:200]}\n")
        return None
    try:
        parsed = json.loads(m.group(0))
    except json.JSONDecodeError:
        return None
    title_ja = parsed.get("title_ja")
    summary = parsed.get("summary")
    if not isinstance(title_ja, str) or not isinstance(summary, str):
        return None
    return {"title_ja": title_ja[:100], "summary": summary[:500]}


def main() -> int:
    if not SUPABASE_URL:
        sys.stderr.write("SUPABASE_URL required\n")
        return 1

    rows = sb_select_rows()
    print(f"[news-enrich] fetched {len(rows)} row(s) to enrich")

    enriched = 0
    failed = 0
    for row in rows:
        row_id = row["id"]
        title = row.get("title") or ""
        url = row.get("url")
        content = fetch_url_content(url) if url else None
        result = summarize(title, content)

        patch: dict = {"enriched_at": _dt.datetime.now(_dt.timezone.utc).isoformat()}
        if result:
            patch["title_ja"] = result["title_ja"]
            patch["summary"] = result["summary"]
            enriched += 1
        else:
            failed += 1

        sb_update_row(row_id, patch)

    print(json.dumps({
        "processed": len(rows),
        "enriched": enriched,
        "failed": failed,
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
