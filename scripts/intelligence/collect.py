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

import requests
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
    """preferences.yaml とダッシュボードのクリックログを統合して preferences を構築する。

    優先度は preferences.yaml の固定スコアを起点に、直近30日の activity_log の
    intelligence_click / intelligence_like をカテゴリ単位で加算する。
    """
    base: dict = {}
    if PREFERENCES_FILE.exists():
        with open(PREFERENCES_FILE, "r", encoding="utf-8") as f:
            base = yaml.safe_load(f) or {}

    merged_scores: dict = dict(base.get("scores", {}))
    click_scores = aggregate_click_scores()
    for key, delta in click_scores.items():
        merged_scores[key] = min(2.0, merged_scores.get(key, 1.0) + delta)
    base["scores"] = merged_scores
    return base


def aggregate_click_scores() -> dict:
    """activity_log から直近30日のクリック/いいねをカテゴリ別に集計してスコア増分を返す。

    1 click = +0.1、1 like = +0.2、上限 +1.0（preferences.yaml の基礎値と合わせて最大 2.0）。
    Supabase Management API 経由で集計するため、RLS の影響を受けない。
    """
    access_token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    project_ref = os.environ.get("SUPABASE_PROJECT_REF", "akycymnahqypmtsfqhtr")
    if not access_token:
        return {}

    query = (
        "SELECT action, metadata->>'category' AS category, count(*) AS cnt "
        "FROM activity_log "
        "WHERE action IN ('intelligence_click','intelligence_like') "
        "AND created_at > now() - interval '30 days' "
        "AND metadata->>'category' IS NOT NULL "
        "GROUP BY action, metadata->>'category'"
    )
    try:
        resp = requests.post(
            f"https://api.supabase.com/v1/projects/{project_ref}/database/query",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            json={"query": query},
            timeout=10,
        )
        if resp.status_code != 200:
            return {}
        rows = resp.json() or []
    except Exception:
        return {}

    deltas: dict = {}
    for row in rows:
        cat = row.get("category")
        if not cat:
            continue
        weight = 0.2 if row.get("action") == "intelligence_like" else 0.1
        delta = min(1.0, weight * int(row.get("cnt", 0)))
        key = f"category:{cat}"
        deltas[key] = max(deltas.get(key, 0), delta)
    return deltas


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
    from ddgs import DDGS

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
    from ddgs import DDGS

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


def _fallback_skeleton_markdown(*, now, window_label: str, items: list[dict]) -> str:
    """LLM が利用不可 / アイテム0件のときに使う最低限のスケルトン Markdown。

    ハルシ防止のため、LLM が呼べないときは要約や示唆を捏造せず、
    生のアイテム一覧を出すだけに留める。
    """
    day_of_week = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][now.weekday()]
    lines = [
        f"# 情報収集レポート - {now.strftime('%Y-%m-%d')} ({day_of_week})",
        "",
        f"**対象期間**: {window_label}",
        f"**収集アイテム数**: {len(items)}",
        "",
        "_LLM 要約は利用不可のためスケルトンのみ出力。アイテム本体は下記。_",
        "",
    ]
    if not items:
        lines.append("## 特筆すべき新規情報なし")
        lines.append("")
        lines.append("直近の探索範囲で、前回レポート以降の新規情報は確認できませんでした。")
        return "\n".join(lines)

    by_type: dict[str, list[dict]] = {}
    for it in items:
        by_type.setdefault(it.get("source_type", "other"), []).append(it)

    if "official_blog" in by_type:
        lines.append("## 🏢 各社レポート・発表")
        lines.append("")
        for it in by_type["official_blog"]:
            lines.append(f"### [{it['title']}]({it['url']})")
            lines.append(f"_{it.get('vendor','')} / {it.get('published_at','')[:10]}_")
            if it.get("summary"):
                lines.append("")
                lines.append(it["summary"])
            lines.append("")

    if "arxiv" in by_type:
        lines.append("## 📄 注目論文")
        lines.append("")
        for it in by_type["arxiv"]:
            arxiv_id = (it.get("extra") or {}).get("arxiv_id", "")
            lines.append(f"### [{it['title']}]({it['url']})")
            lines.append(f"_({arxiv_id}, arXiv, {it.get('published_at','')[:10]})_")
            if it.get("summary"):
                lines.append("")
                lines.append(it["summary"])
            lines.append("")

    return "\n".join(lines)


def main():
    now = datetime.now(JST)
    timestamp = now.strftime("%Y-%m-%d-%H%M")
    date_str = now.strftime("%Y-%m-%d %H:%M JST")

    print(f"[{date_str}] 情報収集を開始します...")

    # ── Step 0: ギャップ分析（interest_articles → sources.yaml 自動更新）────
    # ユーザーが「気になった記事」として登録したものを分析し、
    # 漏れていたドメイン/キーワードを sources.yaml に反映してから収集に入る。
    print("[collect] Step 0: ギャップ分析を実行...")
    gap_script = Path(__file__).parent / "gap-analysis.py"
    if gap_script.exists():
        import subprocess
        try:
            result = subprocess.run(
                [sys.executable, str(gap_script)],
                capture_output=True,
                text=True,
                timeout=60,
            )
            if result.stdout:
                print(result.stdout, end="" if result.stdout.endswith("\n") else "\n")
            if result.returncode != 0 and result.stderr:
                print(
                    f"[collect] gap-analysis 警告: {result.stderr[:500]}",
                    file=sys.stderr,
                )
        except subprocess.TimeoutExpired:
            print(
                "[collect] gap-analysis タイムアウト（60秒）。スキップして続行",
                file=sys.stderr,
            )
        except Exception as e:
            print(
                f"[collect] gap-analysis 実行エラー: {e}。スキップして続行",
                file=sys.stderr,
            )
    else:
        print(
            "[collect] gap-analysis.py が見つかりません。スキップ。",
            file=sys.stderr,
        )
    print("[collect] Step 0 完了。収集を開始します。")

    # ソースと設定を読み込み
    sources = load_sources()
    preferences = load_preferences()

    # ── Step 1: 公式ブログ RSS + arXiv API + 補助 DDG を fetch ──────────
    # ハルシ防止のため、LLM が知識から URL/日付を捏造しないよう
    # 一次ソースから事実を取得する（CLAUDE.md「ハルシネーション禁止」原則）。
    from sources_fetch import (
        fetch_official_feeds,
        fetch_arxiv,
        select_window_with_fallback,
        dedupe_against_previous,
    )
    from llm_compose import (
        compose_report_markdown,
        fetch_dynamic_keywords,
        collect_previous_urls,
    )

    print("[collect] Step 1a: 公式ブログ RSS 取得...")
    official = fetch_official_feeds()
    print(f"  official_blog: {len(official)} 件")

    print("[collect] Step 1b: arXiv 取得...")
    academic_cfg = sources.get("academic_papers", {}).get("arxiv", {}) or {}
    arxiv_cats = academic_cfg.get("categories") or None
    arxiv_kw_cfg = academic_cfg.get("keywords") or []
    arxiv_keywords = [k.get("term") for k in arxiv_kw_cfg if isinstance(k, dict) and k.get("term")]
    arxiv_items = fetch_arxiv(categories=arxiv_cats, keywords=arxiv_keywords or None)
    print(f"  arxiv: {len(arxiv_items)} 件")

    fetched_items = official + arxiv_items

    # ── Step 2: 24h フィルタ + 段階的遡り ──────────────────────────────
    now_utc = datetime.now(timezone.utc)
    window_label, window_hours, items_in_window = select_window_with_fallback(
        fetched_items, now=now_utc, min_items=3
    )
    print(f"[collect] Step 2: window={window_label} ({len(items_in_window)} 件)")

    # ── Step 3: 前回レポートとの差分（既出 URL 除外） ─────────────────
    prev_urls = collect_previous_urls(REPORTS_DIR, lookback_days=14)
    items_diff = dedupe_against_previous(items_in_window, prev_urls)
    print(f"[collect] Step 3: 前回レポ差分後 {len(items_diff)} 件 (除外 {len(items_in_window) - len(items_diff)} 件)")

    # ── Step 4: prompt_log から動的キーワード抽出 ─────────────────────
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_ANON_KEY")
    ingest_key = os.environ.get("SUPABASE_INGEST_KEY", "")
    dynamic_keywords = fetch_dynamic_keywords(supabase_url or "", supabase_key or "", ingest_key)
    if dynamic_keywords:
        print(f"[collect] Step 4: prompt_log キーワード: {dynamic_keywords}")

    # ── Step 5: Claude CLI (opus) でレポート Markdown 生成 ──────────────
    items_for_llm = [it.to_dict() for it in items_diff]
    target_date = now.date()
    md_body: str | None = None
    if items_for_llm:
        print(f"[collect] Step 5: Claude CLI で要約・示唆生成 (model=opus)...")
        md_body = compose_report_markdown(
            items=items_for_llm,
            dynamic_keywords=dynamic_keywords,
            window_label=window_label,
            n_items=len(items_for_llm),
            target_date=now,
        )
    if md_body is None:
        # LLM 失敗 or アイテムなし → スケルトンのレポートを出す
        md_body = _fallback_skeleton_markdown(
            now=now,
            window_label=window_label,
            items=items_for_llm,
        )

    # ── Step 6: 補助として既存 DDG キーワード + X 検索を実行（コンテキスト用） ─
    #   主要レポートは LLM が生成済み。補助情報は別セクションとして JSON に残す。
    collections = []
    keywords_cfg = sources.get("keywords", [])
    if keywords_cfg:
        print(f"  [補助] キーワード検索: {len(keywords_cfg)} 件")
        collections.extend(search_keywords(keywords_cfg, preferences))

    x_accounts = sources.get("x_accounts", [])
    if x_accounts:
        print(f"  [補助] X アカウント検索: {len(x_accounts)} 件")
        collections.extend(search_x_accounts(x_accounts, preferences))

    # ── Step 7: 保存 ────────────────────────────────────────────────
    data = {
        "collected_at": date_str,
        "timestamp": timestamp,
        "window_label": window_label,
        "window_hours": window_hours,
        "items": items_for_llm,  # フィルタ後・差分後のアイテム
        "items_count_total_fetched": len(fetched_items),
        "items_count_in_window": len(items_in_window),
        "items_count_after_dedupe": len(items_diff),
        "dynamic_keywords": dynamic_keywords,
        "collections": collections,  # 補助 DDG/X 検索（既存スキーマ維持）
        "total_sources": len(collections),
        "total_results": sum(len(c.get("results", [])) for c in collections),
    }

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    json_path = REPORTS_DIR / f"{timestamp}.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)
    print(f"  JSON 保存: {json_path}")

    md_path = REPORTS_DIR / f"{timestamp}.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_body)
    print(f"  Markdown 保存: {md_path}")

    # Supabase に保存（ダッシュボード表示用）
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_ANON_KEY")
    ingest_key = os.environ.get("SUPABASE_INGEST_KEY", "")
    if supabase_url and supabase_key:
        try:
            # 1) レポート全体を secretary_notes に保存（既存の挙動）
            resp = requests.post(
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
                print("  secretary_notes: OK")
            else:
                print(f"  secretary_notes: エラー ({resp.status_code})")

            # 2) 各アイテムを news_items にも INSERT してニュースタブに表示させる
            news_saved = 0
            news_dup = 0
            news_err = 0
            today_str = now.strftime("%Y-%m-%d")
            for coll in data["collections"]:
                ctype = coll.get("type", "")
                if ctype == "keyword":
                    src_type = "keyword_search"
                    src_name = f"DuckDuckGo: {coll.get('term', '')}"[:50]
                    topic = coll.get("category", "general")[:30]
                elif ctype == "x_account":
                    src_type = "x_account"
                    src_name = coll.get("handle", "")[:50]
                    topic = coll.get("category", "general")[:30]
                else:
                    continue
                for r in coll.get("results", []):
                    url = r.get("url") or ""
                    title = (r.get("title") or "").strip()
                    if not url or len(title) < 5:
                        continue
                    payload = {
                        "title": title[:200],
                        "summary": (r.get("snippet") or "")[:500],
                        "url": url,
                        "source": src_name,
                        "source_type": src_type,
                        "topic": topic,
                        "published_date": today_str,
                        "collected_at": now.isoformat(),
                    }
                    try:
                        r2 = requests.post(
                            f"{supabase_url}/rest/v1/news_items",
                            headers={
                                "apikey": supabase_key,
                                "Authorization": f"Bearer {supabase_key}",
                                "Content-Type": "application/json",
                                "Prefer": "return=minimal",
                                "x-ingest-key": ingest_key,
                            },
                            json=payload,
                            timeout=10,
                        )
                        if r2.status_code in (200, 201):
                            news_saved += 1
                        elif r2.status_code == 409 or (r2.text and "23505" in r2.text):
                            # duplicate url (partial unique index) — not an error
                            news_dup += 1
                        else:
                            news_err += 1
                    except Exception:
                        news_err += 1
            print(f"  news_items: saved={news_saved} duplicates={news_dup} errors={news_err}")
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
