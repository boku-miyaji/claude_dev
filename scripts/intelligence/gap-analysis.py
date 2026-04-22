#!/usr/bin/env python3
"""
gap-analysis.py — interest_articles のギャップ分析と sources.yaml の自動更新

Step 0 として collect.py から呼ばれる。
未分析の interest_articles を読み取り:
  1. なぜ自動収集できなかったか（gap_type / gap_reason）を判定
  2. sources.yaml に不足エントリを追加（add_to_sources=True の場合）
  3. Supabase の interest_articles を analyzed=true で PATCH
"""

import json
import os
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

import yaml

SOURCES_YAML = Path(__file__).parent.parent.parent / ".company/departments/intelligence/sources.yaml"
SB_SH = Path(__file__).parent.parent.parent / ".claude/hooks/api/sb.sh"


def sb(method: str, *args) -> list | dict | None:
    cmd = [str(SB_SH), method, *args]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        print(f"[gap-analysis] sb.sh {method} error: {result.stderr}", file=sys.stderr)
        return None
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return None


def fetch_unanalyzed_articles() -> list[dict]:
    data = sb("get-auth", "interest_articles", "?analyzed=eq.false&select=id,url,title,tags")
    if not data:
        return []
    return data if isinstance(data, list) else []


def patch_article(article_id: str, gap_type: str, gap_reason: str, added_to_sources: bool) -> None:
    payload = json.dumps({
        "analyzed": True,
        "gap_type": gap_type,
        "gap_reason": gap_reason,
        "added_to_sources": added_to_sources,
    })
    sb("patch", "interest_articles", f"?id=eq.{article_id}", payload)


def extract_domain(url: str) -> str | None:
    try:
        parsed = urlparse(url)
        host = parsed.hostname or ""
        return re.sub(r"^www\.", "", host) if host else None
    except Exception:
        return None


def extract_x_handle(url: str) -> str | None:
    m = re.search(r"(?:twitter\.com|x\.com)/([^/?#]+)", url, re.IGNORECASE)
    if m:
        handle = m.group(1)
        if handle.lower() not in ("home", "search", "explore", "notifications"):
            return f"@{handle}"
    return None


def load_sources() -> dict:
    with open(SOURCES_YAML, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def save_sources(sources: dict) -> None:
    with open(SOURCES_YAML, "w", encoding="utf-8") as f:
        yaml.dump(sources, f, allow_unicode=True, default_flow_style=False, sort_keys=False)


def covered_domains(sources: dict) -> set[str]:
    domains = set()
    for entry in sources.get("web_sources", []):
        d = extract_domain(entry.get("url", ""))
        if d:
            domains.add(d)
    for section in sources.get("tech_articles", []):
        site = section.get("site", "")
        if site:
            d = extract_domain(f"https://{site}")
            domains.add(d or site)
    for section in sources.get("security", {}).get("web_sources", []):
        d = extract_domain(section.get("url", ""))
        if d:
            domains.add(d)
    return domains


def covered_x_handles(sources: dict) -> set[str]:
    handles = set()
    for entry in sources.get("x_accounts", []):
        handles.add(entry.get("handle", "").lower())
    for entry in sources.get("security", {}).get("x_accounts", []):
        handles.add(entry.get("handle", "").lower())
    return handles


def covered_keywords(sources: dict) -> set[str]:
    kws = set()
    for entry in sources.get("keywords", []):
        kws.add(entry.get("term", "").lower())
    for entry in sources.get("academic_papers", {}).get("arxiv", {}).get("keywords", []):
        kws.add(entry.get("term", "").lower())
    return kws


def analyze_article(article: dict, sources: dict) -> dict:
    url = article.get("url", "")
    title = article.get("title", "") or ""
    tags: list[str] = article.get("tags", []) or []

    x_handle = extract_x_handle(url)
    if x_handle:
        existing = covered_x_handles(sources)
        if x_handle.lower() not in existing:
            return {
                "gap_type": "missing_x_account",
                "gap_reason": f"X アカウント {x_handle} が x_accounts に未登録",
                "add": {"section": "x_accounts", "entry": {"handle": x_handle, "category": "個人", "priority": "normal"}},
            }
        else:
            return {
                "gap_type": "already_covered",
                "gap_reason": f"X アカウント {x_handle} は既に監視対象",
                "add": None,
            }

    domain = extract_domain(url)
    if not domain:
        return {"gap_type": "already_covered", "gap_reason": "URL からドメインを抽出できなかった", "add": None}

    all_covered = covered_domains(sources)
    all_keywords = covered_keywords(sources)

    if domain in all_covered:
        # ドメインはカバー済み → キーワードで補足できるか確認
        candidate_kw = None
        for t in tags:
            if t.lower() not in all_keywords and len(t) > 2:
                candidate_kw = t
                break
        if not candidate_kw:
            words = re.findall(r"[A-Za-z][A-Za-z0-9 \-]{3,}", title)
            for w in words:
                if w.lower() not in all_keywords:
                    candidate_kw = w.strip()
                    break

        if candidate_kw:
            return {
                "gap_type": "missing_keyword",
                "gap_reason": f"ドメイン {domain} はカバー済みだがキーワード「{candidate_kw}」が未登録",
                "add": {"section": "keywords", "entry": {"term": candidate_kw, "category": "AI tools", "frequency": "weekly"}},
            }
        else:
            return {
                "gap_type": "already_covered",
                "gap_reason": f"ドメイン {domain} はカバー済み・既知キーワードでもヒットするはずだった",
                "add": None,
            }
    else:
        # ドメイン未登録 → tech_articles に追加
        return {
            "gap_type": "missing_domain",
            "gap_reason": f"ドメイン {domain} がどのソースセクションにも未登録",
            "add": {
                "section": "tech_articles",
                "entry": {
                    "site": domain,
                    "name": domain,
                    "note": title[:60] if title else "",
                    "keywords": tags[:3] if tags else ["AI"],
                    "frequency": "weekly",
                },
            },
        }


def apply_addition(sources: dict, section: str, entry: dict) -> bool:
    if section == "x_accounts":
        existing = [e.get("handle", "").lower() for e in sources.get("x_accounts", [])]
        if entry["handle"].lower() in existing:
            return False
        sources.setdefault("x_accounts", []).append(entry)
        return True

    if section == "keywords":
        existing = [e.get("term", "").lower() for e in sources.get("keywords", [])]
        if entry["term"].lower() in existing:
            return False
        sources.setdefault("keywords", []).append(entry)
        return True

    if section == "tech_articles":
        existing_sites = [e.get("site", "").lower() for e in sources.get("tech_articles", [])]
        if entry["site"].lower() in existing_sites:
            return False
        sources.setdefault("tech_articles", []).append(entry)
        return True

    return False


def main() -> None:
    articles = fetch_unanalyzed_articles()
    if not articles:
        print("[gap-analysis] 未分析の interest_articles はありません")
        return

    print(f"[gap-analysis] {len(articles)} 件の未分析記事を処理します")

    sources = load_sources()
    sources_changed = False

    for article in articles:
        aid = article["id"]
        url = article.get("url", "")
        print(f"  → {url}")

        result = analyze_article(article, sources)
        gap_type = result["gap_type"]
        gap_reason = result["gap_reason"]
        added = False

        if result["add"]:
            added = apply_addition(sources, result["add"]["section"], result["add"]["entry"])
            if added:
                sources_changed = True
                print(f"     [{gap_type}] {gap_reason} → sources.yaml に追加")
            else:
                print(f"     [{gap_type}] {gap_reason} → 既に存在（重複スキップ）")
        else:
            print(f"     [{gap_type}] {gap_reason}")

        patch_article(aid, gap_type, gap_reason, added)

    if sources_changed:
        save_sources(sources)
        print(f"[gap-analysis] sources.yaml を更新しました: {SOURCES_YAML}")
    else:
        print("[gap-analysis] sources.yaml の変更なし")


if __name__ == "__main__":
    main()
