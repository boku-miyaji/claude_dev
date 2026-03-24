#!/usr/bin/env python3
"""
情報収集部 - 自動収集スクリプト
GitHub Actions から定期実行され、生データを収集してレポートを生成する。

収集ソース:
  1. キーワード検索（DuckDuckGo）
  2. X アカウント検索（DuckDuckGo site:x.com 検索）

出力:
  - .company/departments/intelligence/reports/YYYY-MM-DD-HHMM.json  (生データ)
  - .company/departments/intelligence/reports/YYYY-MM-DD-HHMM.md    (閲覧用)
"""

import json
import os
import sys
import time
import random
from datetime import datetime, timezone, timedelta
from pathlib import Path

import yaml

# ── 定数 ──────────────────────────────────────────────
JST = timezone(timedelta(hours=9))
REPORTS_DIR = Path(".company/departments/intelligence/reports")
SOURCES_FILE = Path(".company/departments/intelligence/sources.yaml")
PREFERENCES_FILE = Path(".company/departments/intelligence/preferences.yaml")

MAX_RESULTS_PER_KEYWORD = 5
MAX_RESULTS_PER_ACCOUNT = 5
EXPLORATION_RATIO = 0.2  # 過学習防止: 20% は探索枠


def load_sources() -> dict:
    """sources.yaml を読み込む"""
    with open(SOURCES_FILE, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_preferences() -> dict:
    """preferences.yaml を読み込む（なければデフォルト）"""
    if PREFERENCES_FILE.exists():
        with open(PREFERENCES_FILE, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    return {}


def get_score(preferences: dict, item_id: str, category: str) -> float:
    """アイテムのスコアを取得（高い = 優先表示）"""
    scores = preferences.get("scores", {})
    # カテゴリレベルのスコア
    cat_score = scores.get(f"category:{category}", 1.0)
    # ソースレベルのスコア
    src_score = scores.get(item_id, 1.0)
    return cat_score * src_score


def should_include_as_exploration() -> bool:
    """探索枠として含めるか（過学習防止）"""
    return random.random() < EXPLORATION_RATIO


def search_keywords(keywords: list, preferences: dict) -> list:
    """キーワード検索を実行"""
    from duckduckgo_search import DDGS

    results = []
    for kw_config in keywords:
        term = kw_config["term"]
        category = kw_config.get("category", "general")
        item_id = f"keyword:{term}"
        score = get_score(preferences, item_id, category)

        # スコアが低くても探索枠で拾う可能性あり
        if score < 0.3 and not should_include_as_exploration():
            continue

        try:
            with DDGS() as ddgs:
                search_results = list(
                    ddgs.text(term, max_results=MAX_RESULTS_PER_KEYWORD)
                )
            results.append(
                {
                    "type": "keyword",
                    "term": term,
                    "category": category,
                    "score": round(score, 2),
                    "is_exploration": score < 0.3,
                    "results": [
                        {
                            "title": r.get("title", ""),
                            "url": r.get("href", ""),
                            "snippet": r.get("body", ""),
                        }
                        for r in search_results
                    ],
                }
            )
            time.sleep(1)  # レート制限対策
        except Exception as e:
            results.append(
                {
                    "type": "keyword",
                    "term": term,
                    "category": category,
                    "error": str(e),
                    "results": [],
                }
            )

    return results


def search_x_accounts(accounts: list, preferences: dict) -> list:
    """X アカウントの最新投稿を検索（DuckDuckGo 経由）"""
    from duckduckgo_search import DDGS

    results = []
    for account in accounts:
        handle = account["handle"].lstrip("@")
        category = account.get("category", "general")
        item_id = f"x:{handle}"
        score = get_score(preferences, item_id, category)

        if score < 0.3 and not should_include_as_exploration():
            continue

        try:
            query = f"site:x.com from:{handle}"
            with DDGS() as ddgs:
                search_results = list(
                    ddgs.text(query, max_results=MAX_RESULTS_PER_ACCOUNT)
                )
            results.append(
                {
                    "type": "x_account",
                    "handle": f"@{handle}",
                    "category": category,
                    "priority": account.get("priority", "normal"),
                    "score": round(score, 2),
                    "is_exploration": score < 0.3,
                    "results": [
                        {
                            "title": r.get("title", ""),
                            "url": r.get("href", ""),
                            "snippet": r.get("body", ""),
                        }
                        for r in search_results
                    ],
                }
            )
            time.sleep(1)
        except Exception as e:
            results.append(
                {
                    "type": "x_account",
                    "handle": f"@{handle}",
                    "category": category,
                    "error": str(e),
                    "results": [],
                }
            )

    return results


def generate_markdown(data: dict) -> str:
    """生データからMarkdownレポートを生成"""
    ts = data["collected_at"]
    lines = [f"# 情報収集レポート - {ts}", ""]

    # キーワード検索結果
    kw_results = [r for r in data["collections"] if r["type"] == "keyword"]
    if kw_results:
        lines.append("## キーワード検索")
        lines.append("")
        for kw in kw_results:
            tag = " [探索]" if kw.get("is_exploration") else ""
            lines.append(f"### \"{kw['term']}\"{tag}")
            if kw.get("error"):
                lines.append(f"- エラー: {kw['error']}")
            else:
                for i, r in enumerate(kw["results"], 1):
                    item_id = f"kw-{kw['term'][:10]}-{i}"
                    lines.append(
                        f"- **[{item_id}]** [{r['title']}]({r['url']})"
                    )
                    if r["snippet"]:
                        lines.append(f"  > {r['snippet'][:200]}")
            lines.append("")

    # X アカウント結果
    x_results = [r for r in data["collections"] if r["type"] == "x_account"]
    if x_results:
        lines.append("## X アカウント動向")
        lines.append("")
        for x in x_results:
            tag = " [探索]" if x.get("is_exploration") else ""
            lines.append(f"### {x['handle']}{tag}")
            if x.get("error"):
                lines.append(f"- エラー: {x['error']}")
            else:
                for i, r in enumerate(x["results"], 1):
                    item_id = f"x-{x['handle'][1:6]}-{i}"
                    lines.append(
                        f"- **[{item_id}]** [{r['title']}]({r['url']})"
                    )
                    if r["snippet"]:
                        lines.append(f"  > {r['snippet'][:200]}")
            lines.append("")

    # メタ情報
    lines.append("---")
    lines.append(f"収集時刻: {ts} | ソース数: {len(data['collections'])}")
    lines.append("フィードバック: `/company` で `[item_id] 有用` または `[item_id] ノイズ` と伝えてください")

    return "\n".join(lines)


def main():
    now = datetime.now(JST)
    timestamp = now.strftime("%Y-%m-%d-%H%M")
    date_str = now.strftime("%Y-%m-%d %H:%M JST")

    print(f"[{date_str}] 情報収集を開始します...")

    # ソースと設定を読み込み
    sources = load_sources()
    preferences = load_preferences()

    # 収集実行
    collections = []

    keywords = sources.get("keywords", [])
    if keywords:
        print(f"  キーワード検索: {len(keywords)} 件")
        collections.extend(search_keywords(keywords, preferences))

    x_accounts = sources.get("x_accounts", [])
    if x_accounts:
        print(f"  X アカウント検索: {len(x_accounts)} 件")
        collections.extend(search_x_accounts(x_accounts, preferences))

    # 生データ保存
    data = {
        "collected_at": date_str,
        "timestamp": timestamp,
        "total_sources": len(collections),
        "total_results": sum(len(c.get("results", [])) for c in collections),
        "collections": collections,
    }

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    json_path = REPORTS_DIR / f"{timestamp}.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  JSON 保存: {json_path}")

    md_path = REPORTS_DIR / f"{timestamp}.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(generate_markdown(data))
    print(f"  Markdown 保存: {md_path}")

    # Supabase に保存（ダッシュボード表示用）
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_ANON_KEY")
    ingest_key = os.environ.get("SUPABASE_INGEST_KEY", "")
    if supabase_url and supabase_key:
        try:
            import requests as req

            resp = req.post(
                f"{supabase_url}/rest/v1/secretary_notes",
                headers={
                    "apikey": supabase_key,
                    "Authorization": f"Bearer {supabase_key}",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal",
                    "x-ingest-key": ingest_key,
                },
                json={
                    "type": "intelligence_report",
                    "title": f"情報収集レポート {now.strftime('%Y-%m-%d %H:%M')}",
                    "body": json.dumps(data, ensure_ascii=False),
                    "note_date": now.strftime("%Y-%m-%d"),
                    "tags": ["intelligence", "auto"],
                },
                timeout=10,
            )
            if resp.status_code in (200, 201):
                print("  Supabase 保存: OK")
            else:
                print(f"  Supabase 保存: エラー ({resp.status_code})")
        except Exception as e:
            print(f"  Supabase 保存: スキップ ({e})")
    else:
        print("  Supabase: 環境変数未設定、スキップ")

    # 古いレポートの件数を表示
    report_files = sorted(REPORTS_DIR.glob("*.json"))
    if len(report_files) > 30:
        print(f"  注意: レポートが {len(report_files)} 件あります。古いものの整理を検討してください")

    print(f"[{date_str}] 完了: {data['total_results']} 件の結果を収集")


if __name__ == "__main__":
    main()
