#!/usr/bin/env python3
"""
_fetch_candidates.py

stdin: 検索クエリ（1行1クエリ、最大5行）
stdout: 名言候補の JSON 配列

フロー:
  1. quotes キャッシュを検索（source_queries 配列と GIN 検索）
  2. 15件以上取れたらそこで終了（Web検索スキップ）
  3. 不足時: Claude CLI + WebSearch で取得
  4. 正規化後に quotes へ UPSERT（dedup_key UNIQUE）
  5. 候補配列を stdout に出力

環境変数必須:
  SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_INGEST_KEY

注: Claude CLI WebSearch 許可フラグは `--allowedTools WebSearch`。
CLI バージョンにより `--allowed-tools` でも受け付けるため両対応。
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
from typing import Any

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
SUPABASE_INGEST_KEY = os.environ.get("SUPABASE_INGEST_KEY", "")

CACHE_SUFFICIENT_THRESHOLD = 15
MAX_CANDIDATES_FROM_WEB = 20


def normalize_body(body: str) -> str:
    """名言本文の正規化（重複判定用）。"""
    s = (body or "").strip()
    # 引用符類を剥がす
    for ch in ['"', "'", "\u201C", "\u201D", "「", "」", "『", "』"]:
        s = s.strip(ch)
    # 連続空白を単一スペースに
    s = re.sub(r"\s+", " ", s)
    # 全角記号→半角
    s = s.translate(str.maketrans("!?.,;:", "!?.,;:"))
    # 末尾句読点
    s = s.rstrip("。.!?")
    return s.lower()


def normalize_author(author: str) -> str:
    a = (author or "").strip()
    a = re.sub(r"(さん|氏|先生|博士|教授|Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.)", "", a)
    return a.strip().lower()


def make_dedup_key(body: str, author: str) -> str:
    nb = normalize_body(body)
    na = normalize_author(author)
    return hashlib.sha256(f"{nb}|{na}".encode("utf-8")).hexdigest()


def http_get(path: str, params: dict[str, str]) -> list[dict[str, Any]]:
    """Supabase REST GET。curl 経由（依存追加を避ける）。"""
    import urllib.parse

    query = urllib.parse.urlencode(params)
    url = f"{SUPABASE_URL}/rest/v1/{path}?{query}"
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


def http_post_upsert(table: str, payload: list[dict[str, Any]]) -> bool:
    """Supabase REST POST (on_conflict merge-duplicates)。
    dedup_key の UNIQUE に対し UPSERT を行う。
    """
    if not payload:
        return True
    url = f"{SUPABASE_URL}/rest/v1/{table}?on_conflict=dedup_key"
    try:
        r = subprocess.run(
            [
                "curl", "-s", "-X", "POST", url,
                "-H", f"apikey: {SUPABASE_ANON_KEY}",
                "-H", f"Authorization: Bearer {SUPABASE_ANON_KEY}",
                "-H", f"x-ingest-key: {SUPABASE_INGEST_KEY}",
                "-H", "Content-Type: application/json",
                "-H", "Prefer: resolution=merge-duplicates,return=representation",
                "-d", json.dumps(payload, ensure_ascii=False),
            ],
            capture_output=True, text=True, timeout=30,
        )
        return r.returncode == 0
    except Exception:
        return False


def search_cache(queries: list[str]) -> list[dict[str, Any]]:
    """source_queries 配列に当該クエリを含む既存 quotes を取得。

    PostgREST で配列の overlap (`&&`) は `?col=cs.{...}` (contains) もしくは `ov.` で書ける。
    ここでは or 条件で各クエリごとに ov を掛ける。不足分は Web 検索で補う前提。
    """
    if not queries:
        return []
    # PostgREST: array overlap は ov.{a,b,c} (JSON/配列の overlap)
    # 複数クエリは or で OR 連結
    escaped = []
    for q in queries:
        # PostgREST の or は値に ( ) が使えない—シンプルに URL エンコード
        safe = q.replace(",", " ").replace("(", " ").replace(")", " ")
        escaped.append(f"source_queries.ov.{{{safe}}}")
    or_clause = f"or=({','.join(escaped)})"
    params = {
        "select": "id,body,body_lang,author,author_era,source,source_url,emotion_tags,voice_tags,theme_tags,source_reliability,quality_score,dedup_key,body_normalized",
        "limit": "30",
        "is_banned": "eq.false",
    }
    # 素の and 条件に or をマージする場合は PostgREST の制約があるため、個別に curl ビルド
    import urllib.parse

    query_str = urllib.parse.urlencode(params)
    url = f"{SUPABASE_URL}/rest/v1/quotes?{query_str}&{or_clause}"
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


def build_websearch_prompt(queries: list[str]) -> str:
    bullets = "\n".join(f"- {q}" for q in queries)
    return f"""あなたは名言検索アシスタントです。以下の検索クエリそれぞれを WebSearch ツールで実行し、
得られた結果から名言を抽出してください。

検索クエリ:
{bullets}

抽出条件:
- 発言者が特定できるもののみ（匿名・「ことわざ」は除外）
- 本文は日本語原文 or 英語原文（混在可）
- 同一の名言が複数クエリでヒットしたら1件に統合（表記ゆれは統一）
- 各名言に対して emotion_tags（Plutchik 8感情のうち該当するもの）と
  voice_tags（cheer / calm / challenge / company / permission / reframe のうち該当するもの）を付与

出力 JSON（配列、他の文字は出さない）:
[
  {{
    "body": "名言本文",
    "body_lang": "ja" or "en",
    "author": "発言者（フルネーム or 通称）",
    "author_era": "年代 / 時代（例: 1960s, 19世紀, 古代ギリシア, 不明）",
    "source": "出典（書籍・演説・インタビュー等）",
    "source_url": "引用元URL（Web検索結果のもの）",
    "matched_query": "ヒットした検索クエリ",
    "emotion_tags": ["joy", ...],
    "voice_tags": ["cheer", ...]
  }}
]

最大{MAX_CANDIDATES_FROM_WEB}件。JSON配列のみ出力:"""


def call_claude_websearch(prompt: str) -> list[dict[str, Any]]:
    """Claude CLI + WebSearch で名言候補を取得。"""
    try:
        # 最大2回リトライ
        for attempt in range(2):
            try:
                proc = subprocess.run(
                    ["claude", "--print", "--model", "opus", "--allowedTools", "WebSearch"],
                    input=prompt,
                    capture_output=True,
                    text=True,
                    timeout=180,
                )
                raw = proc.stdout.strip()
                if raw:
                    m = re.search(r"\[[\s\S]*\]", raw)
                    if m:
                        try:
                            parsed = json.loads(m.group(0))
                            if isinstance(parsed, list):
                                return parsed
                        except json.JSONDecodeError:
                            pass
            except subprocess.TimeoutExpired:
                pass
        return []
    except Exception:
        return []


def is_url_reliable(url: str | None) -> float:
    if not url:
        return 0.1
    reliable_domains = [
        "wikipedia.org", "wikiquote.org",
        "goodreads.com", "brainyquote.com",
        "archive.org", "ndl.go.jp",
    ]
    u = url.lower()
    for d in reliable_domains:
        if d in u:
            return 1.0
    return 0.3


def upsert_quotes(quotes: list[dict[str, Any]], source_queries: list[str]) -> list[dict[str, Any]]:
    """候補を正規化して quotes に UPSERT し、保存済み行を返す（id 付き）。"""
    payload = []
    for q in quotes:
        body = (q.get("body") or "").strip()
        author = (q.get("author") or "").strip()
        if not body or not author or len(body) > 500:
            continue
        body_lang = q.get("body_lang") or "ja"
        if body_lang not in ("ja", "en"):
            body_lang = "ja"
        emotion_tags = [t for t in (q.get("emotion_tags") or []) if isinstance(t, str)]
        voice_tags = [t for t in (q.get("voice_tags") or []) if isinstance(t, str)]
        payload.append({
            "body": body,
            "body_lang": body_lang,
            "author": author,
            "author_era": q.get("author_era"),
            "source": q.get("source"),
            "source_url": q.get("source_url"),
            "dedup_key": make_dedup_key(body, author),
            "body_normalized": normalize_body(body),
            "emotion_tags": emotion_tags,
            "voice_tags": voice_tags,
            "theme_tags": [],
            "source_queries": source_queries,
            "source_reliability": is_url_reliable(q.get("source_url")),
        })

    if not payload:
        return []

    ok = http_post_upsert("quotes", payload)
    if not ok:
        return []

    # UPSERT 後、dedup_key で改めて取得して id 付きで返す
    dedup_keys = [p["dedup_key"] for p in payload]
    import urllib.parse

    if not dedup_keys:
        return []
    keys_in = ",".join(dedup_keys)
    url = f"{SUPABASE_URL}/rest/v1/quotes?select=id,body,body_lang,author,author_era,source,source_url,emotion_tags,voice_tags,theme_tags,source_reliability,quality_score,dedup_key,body_normalized&dedup_key=in.({urllib.parse.quote(keys_in)})"
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
        if r.returncode == 0 and r.stdout.strip():
            data = json.loads(r.stdout)
            return data if isinstance(data, list) else []
    except Exception:
        pass
    return []


def main() -> int:
    queries = [line.strip() for line in sys.stdin if line.strip()]
    if not queries:
        print("[]")
        return 0

    # Step 3a: cache 検索
    cached = search_cache(queries)

    # Step 3b: 不足時は Web検索
    need_web = len(cached) < CACHE_SUFFICIENT_THRESHOLD
    fetched: list[dict[str, Any]] = []
    if need_web:
        prompt = build_websearch_prompt(queries)
        fetched = call_claude_websearch(prompt)
        if fetched:
            fetched = upsert_quotes(fetched, queries)

    # マージ（id ベースで dedup）
    seen_ids: set[str] = set()
    combined: list[dict[str, Any]] = []
    for q in cached + fetched:
        qid = q.get("id")
        if qid and qid not in seen_ids:
            seen_ids.add(qid)
            combined.append(q)

    print(json.dumps(combined, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
