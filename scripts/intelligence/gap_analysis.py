#!/usr/bin/env python3
"""情報収集部 - ギャップ分析スクリプト（実装本体）.

ユーザーが `interest_articles` テーブルに登録した「気になった記事」を分析し、
情報収集部の `sources.yaml` がなぜそれを拾えなかったかを特定して、
`sources.yaml` を自動更新する。

処理フロー:
    1. Supabase から interest_articles (analyzed=false) を取得
    2. sources.yaml を読み込み
    3. 各記事について gap を分析:
       - already_covered   : ドメインもキーワードもある
       - missing_domain    : ドメインが sources.yaml にない
       - missing_keyword   : ドメインはあるがキーワードが不足
       - missing_x_account : x.com / twitter.com で @handle が未登録
    4. sources.yaml を更新（適切なセクションに追加）
    5. interest_articles を PATCH（analyzed=true, gap_type, gap_reason, added_to_sources）
    6. sources.yaml を保存

環境変数:
    SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_INGEST_KEY, SUPABASE_ACCESS_TOKEN

設計方針:
    - Supabase unreachable → ローカル cache にフォールバックして続行
    - sources.yaml 書き込み失敗 → stderr に警告して続行（収集バッチを止めない）
    - 全ての requests に timeout=30
    - 既存エントリとの重複チェックは `auto_added` 属性で識別
"""
from __future__ import annotations

import os
import re
import sys
from datetime import date as _date
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests
import yaml


# ── パス設定 ───────────────────────────────────────────────────────
SOURCES_FILE = Path(".company/departments/intelligence/sources.yaml")
CACHE_FILE = Path(".company/departments/intelligence/interest_articles_cache.yaml")


# ── ドメイン → ソースタイプ判定 ────────────────────────────────────
DOMAIN_TO_SOURCE_TYPE: dict[str, str] = {
    "zenn.dev": "tech_article",
    "qiita.com": "tech_article",
    "note.com": "tech_article",
    "medium.com": "tech_article",
    "dev.to": "tech_article",
    "hashnode.dev": "tech_article",
    "arxiv.org": "academic",
    "huggingface.co": "tech_article",
    "github.com": "github",
    "x.com": "x_account",
    "twitter.com": "x_account",
}

# ドメインから tech_articles エントリの `site` 用の代表形に寄せるためのマップ
# (例: huggingface.co/blog → huggingface.co/blog は今後手動で整える。まずは netloc のみ)
TECH_ARTICLE_SITE_ALIASES: dict[str, str] = {
    # 現状はそのまま使う。将来、サイト内のサブパスを分けたい場合にここで吸収する
}


# ── ドメイン抽出・キーワード抽出 ───────────────────────────────────
def extract_domain(url: str) -> str:
    """URL から netloc（小文字・www プレフィクス除去）を取り出す。"""
    try:
        netloc = urlparse(url).netloc or ""
    except Exception:
        return ""
    return netloc.replace("www.", "").lower()


def extract_x_handle(url: str) -> str | None:
    """x.com / twitter.com の URL から @handle を抽出。"""
    domain = extract_domain(url)
    if domain not in ("x.com", "twitter.com"):
        return None
    try:
        path = urlparse(url).path or ""
    except Exception:
        return None
    # /@handle or /handle の形式
    segs = [s for s in path.split("/") if s]
    if not segs:
        return None
    handle = segs[0].lstrip("@")
    # status, home, search 等の予約語を避ける
    reserved = {"home", "search", "explore", "notifications", "messages", "i"}
    if handle.lower() in reserved:
        return None
    # 英数と _ のみの簡易バリデーション
    if not re.match(r"^[A-Za-z0-9_]{1,20}$", handle):
        return None
    return f"@{handle}"


# 日本語（カタカナ・漢字・ひらがな）の連続した塊と、英数字の単語を抽出する正規表現
# - 日本語は連続する漢字・カタカナを「単語的フレーズ」として拾う（簡易ヒューリスティック）
# - 英数字は 2 文字以上の単語を拾う
_JP_TOKEN_RE = re.compile(
    r"[一-鿿゠-ヿ぀-ゟ]+"
)
_EN_TOKEN_RE = re.compile(r"[A-Za-z][A-Za-z0-9\-_+.]{1,}")

# ノイズとして除外するストップワード（英語・日本語）
_STOPWORDS = {
    # 英語・一般
    "the", "and", "for", "with", "from", "this", "that", "your", "you",
    "how", "why", "what", "when", "into", "using", "use", "via",
    # タイトルに頻出する「記事っぽい」語
    "blog", "post", "article", "paper", "docs", "doc", "page", "news",
    # 日本語・助詞的なカタカナ語は正規表現で弾かれる想定なので控えめ
    "する", "した", "しない", "ある", "いる", "ない",
    "こと", "もの", "とき", "ため", "より", "など",
    "さん", "くん", "ちゃん",
}


def extract_keywords(title: str | None) -> list[str]:
    """タイトルから抽出対象のキーワードを返す（重複除去済み・小文字揃え）.

    - 英語は単語単位（2 文字以上）
    - 日本語は連続する漢字/カナ/ひらがなの塊（2 文字以上）
    - 数字のみ・ストップワードは除外
    """
    if not title:
        return []

    raw: list[str] = []
    raw.extend(_JP_TOKEN_RE.findall(title))
    raw.extend(_EN_TOKEN_RE.findall(title))

    seen: set[str] = set()
    out: list[str] = []
    for token in raw:
        normalized = token.strip()
        if len(normalized) < 2:
            continue
        key = normalized.lower()
        if key in _STOPWORDS:
            continue
        if key.isdigit():
            continue
        if key in seen:
            continue
        seen.add(key)
        out.append(normalized)
    return out


# ── sources.yaml 照合ロジック ──────────────────────────────────────
def _collect_all_keywords(sources: dict) -> set[str]:
    """sources.yaml 内のあらゆる箇所のキーワードを小文字で集約して返す."""
    kws: set[str] = set()
    # 1) 直下の keywords (キーワード検索)
    for kw in sources.get("keywords", []) or []:
        term = (kw or {}).get("term")
        if term:
            kws.add(str(term).lower())
    # 2) tech_articles[*].keywords
    for ta in sources.get("tech_articles", []) or []:
        for k in (ta or {}).get("keywords", []) or []:
            kws.add(str(k).lower())
    # 3) academic_papers.arxiv.keywords[*].term
    arxiv = (sources.get("academic_papers") or {}).get("arxiv", {}) or {}
    for kw in arxiv.get("keywords", []) or []:
        term = (kw or {}).get("term")
        if term:
            kws.add(str(term).lower())
    # 4) security.keywords[*].term
    for kw in (sources.get("security") or {}).get("keywords", []) or []:
        term = (kw or {}).get("term")
        if term:
            kws.add(str(term).lower())
    # 5) hacker_news.keywords
    for k in (sources.get("hacker_news") or {}).get("keywords", []) or []:
        kws.add(str(k).lower())
    return kws


def domain_in_sources(domain: str, sources: dict) -> bool:
    """ドメインが sources.yaml のどこかに登録されているか確認する."""
    if not domain:
        return False
    dom = domain.lower()

    # web_sources にドメインが含まれるか
    for ws in sources.get("web_sources", []) or []:
        url = (ws or {}).get("url", "") or ""
        if dom in url.lower():
            return True

    # security.web_sources にもある
    sec_web = (sources.get("security") or {}).get("web_sources", []) or []
    for ws in sec_web:
        url = (ws or {}).get("url", "") or ""
        if dom in url.lower():
            return True

    # tech_articles.site に含まれるか
    for ta in sources.get("tech_articles", []) or []:
        site = (ta or {}).get("site", "") or ""
        if site and (site.lower() == dom or dom in site.lower() or site.lower() in dom):
            return True

    return False


def x_handle_in_sources(handle: str, sources: dict) -> bool:
    """X ハンドル（@xxx 形式）が sources.yaml の x_accounts に登録済みか確認する."""
    if not handle:
        return False
    h = handle.lower()

    for ent in sources.get("x_accounts", []) or []:
        existing = (ent or {}).get("handle", "") or ""
        if existing.lower() == h:
            return True

    sec_x = (sources.get("security") or {}).get("x_accounts", []) or []
    for ent in sec_x:
        existing = (ent or {}).get("handle", "") or ""
        if existing.lower() == h:
            return True

    return False


def find_tech_article_entry(domain: str, sources: dict) -> dict | None:
    """tech_articles の中で該当ドメインのエントリを返す (辞書への参照)."""
    if not domain:
        return None
    dom = domain.lower()
    for ta in sources.get("tech_articles", []) or []:
        site = (ta or {}).get("site", "") or ""
        if site and (site.lower() == dom or dom in site.lower() or site.lower() in dom):
            return ta
    return None


# ── gap 分類 ───────────────────────────────────────────────────────
def _keyword_covered_by_existing(keyword: str, existing_kws: set[str]) -> bool:
    """抽出キーワードが既存の sources.yaml のどこかでカバーされているか判定する.

    既存 keywords はフレーズ単位（例: "Claude Code"）、一方で抽出結果は単語単位
    （"Claude", "Code"）になりうるので、以下の条件のどれかを満たせばカバー済みとする:
        - 完全一致
        - 抽出キーワードが既存フレーズの部分文字列（単語境界）
        - 既存フレーズが抽出キーワードの部分文字列
    すべて小文字で比較する.
    """
    k = keyword.lower()
    for ex in existing_kws:
        if not ex:
            continue
        if k == ex:
            return True
        # 単語を含むフレーズは「カバー済み」扱い（例: "Claude" vs "claude code"）
        # 空白で分割したトークンに完全一致するかチェックする
        ex_tokens = set(re.split(r"[\s/_\-]+", ex))
        if k in ex_tokens:
            return True
        k_tokens = set(re.split(r"[\s/_\-]+", k))
        if ex in k_tokens:
            return True
    return False


def classify_gap(
    url: str, title: str | None, sources: dict
) -> tuple[str, str, dict[str, Any]]:
    """gap_type, gap_reason, extras を返す.

    extras には後段で sources.yaml 更新に使う情報を入れる:
        - domain       : 抽出ドメイン
        - source_type  : tech_article / web_source / x_account / academic / github / unknown
        - x_handle     : X 用ハンドル（@付き）
        - keywords     : タイトルから抽出したキーワード
        - new_keywords : sources.yaml に未登録のキーワード
    """
    domain = extract_domain(url)
    source_type = DOMAIN_TO_SOURCE_TYPE.get(domain, "unknown")
    keywords = extract_keywords(title)
    existing_kws = _collect_all_keywords(sources)
    new_keywords = [
        k for k in keywords if not _keyword_covered_by_existing(k, existing_kws)
    ]

    x_handle: str | None = None
    if source_type == "x_account":
        x_handle = extract_x_handle(url)
        if x_handle and not x_handle_in_sources(x_handle, sources):
            return (
                "missing_x_account",
                f"X ハンドル {x_handle} が x_accounts に未登録",
                {
                    "domain": domain,
                    "source_type": source_type,
                    "x_handle": x_handle,
                    "keywords": keywords,
                    "new_keywords": new_keywords,
                },
            )
        # X ドメインだが handle が取れない or 既登録なら already_covered 扱い
        return (
            "already_covered",
            "X ドメインは対象内",
            {
                "domain": domain,
                "source_type": source_type,
                "x_handle": x_handle,
                "keywords": keywords,
                "new_keywords": new_keywords,
            },
        )

    if not domain_in_sources(domain, sources):
        return (
            "missing_domain",
            f"ドメイン {domain or '(不明)'} が sources.yaml に未登録",
            {
                "domain": domain,
                "source_type": source_type,
                "x_handle": None,
                "keywords": keywords,
                "new_keywords": new_keywords,
            },
        )

    # ドメインはあるが、タイトルのキーワードがどれも sources に無ければ missing_keyword
    if keywords and new_keywords:
        return (
            "missing_keyword",
            (
                f"ドメイン {domain} は登録済みだが、タイトルのキーワード "
                f"{new_keywords[:3]} が既存 keywords に不足"
            ),
            {
                "domain": domain,
                "source_type": source_type,
                "x_handle": None,
                "keywords": keywords,
                "new_keywords": new_keywords,
            },
        )

    return (
        "already_covered",
        "ドメインもキーワードも既存 sources で網羅済み",
        {
            "domain": domain,
            "source_type": source_type,
            "x_handle": None,
            "keywords": keywords,
            "new_keywords": new_keywords,
        },
    )


# ── sources.yaml 更新 ──────────────────────────────────────────────
def _today_iso() -> str:
    return _date.today().isoformat()


def _make_auto_note(title: str | None) -> str:
    t = (title or "").strip()
    if not t:
        return "interest_articles 学習: (無題)"
    return f"interest_articles 学習: {t[:80]}"


def apply_update_to_sources(
    sources: dict,
    url: str,
    title: str | None,
    gap_type: str,
    extras: dict[str, Any],
) -> bool:
    """gap_type に応じて sources に変更を加える。変更が発生したら True を返す。

    注意: 辞書 sources を in-place で書き換える。
    """
    changed = False
    today = _today_iso()
    note = _make_auto_note(title)

    if gap_type == "missing_domain":
        source_type = extras.get("source_type", "unknown")
        domain = extras.get("domain", "") or ""
        keywords = extras.get("new_keywords") or extras.get("keywords") or []
        first_kw = keywords[0] if keywords else ""

        if source_type == "tech_article" or source_type == "academic":
            # tech_articles に追加（academic もそちらに寄せる：sources の site ベースで扱える）
            entry = {
                "site": domain,
                "name": f"{domain.split('.')[0].capitalize()}（自動追加）",
                "note": note,
                "keywords": [first_kw] if first_kw else [],
                "frequency": "weekly",
                "auto_added": True,
                "added_date": today,
            }
            sources.setdefault("tech_articles", []).append(entry)
            changed = True

        elif source_type == "github":
            # github_releases は "repo" 単位だが、ここでは URL だけではリポジトリ名が確定できない
            # ので web_sources に入れる（既存構造を壊さない安全策）
            origin = urlparse(url)
            base_url = f"{origin.scheme}://{origin.netloc}{origin.path}".rstrip("/")
            entry = {
                "url": base_url or url,
                "category": "tech news",
                "name": f"{domain}（自動追加）",
                "note": note,
                "frequency": "weekly",
                "auto_added": True,
                "added_date": today,
            }
            sources.setdefault("web_sources", []).append(entry)
            changed = True

        else:
            # それ以外は web_sources へ
            origin = urlparse(url)
            base_url = f"{origin.scheme}://{origin.netloc}" if origin.netloc else url
            entry = {
                "url": base_url,
                "category": "tech news",
                "name": f"{domain}（自動追加）",
                "note": note,
                "frequency": "weekly",
                "auto_added": True,
                "added_date": today,
            }
            sources.setdefault("web_sources", []).append(entry)
            changed = True

    elif gap_type == "missing_keyword":
        domain = extras.get("domain", "") or ""
        new_keywords = extras.get("new_keywords") or []
        if not new_keywords:
            return False

        # 最も近い既存 tech_article エントリに追加
        entry = find_tech_article_entry(domain, sources)
        if entry is not None:
            kws = list(entry.get("keywords") or [])
            # 既存と重複しないものだけ追加（大小文字無視で比較）
            existing_lower = {str(k).lower() for k in kws}
            added_any = False
            for nk in new_keywords[:3]:  # 一度に入れすぎない
                if nk.lower() not in existing_lower:
                    kws.append(nk)
                    existing_lower.add(nk.lower())
                    added_any = True
            if added_any:
                entry["keywords"] = kws
                changed = True
        else:
            # tech_article エントリが見つからなければ、最上位の keywords に追加
            kwlist = sources.setdefault("keywords", [])
            existing_terms = {str((k or {}).get("term", "")).lower() for k in kwlist}
            for nk in new_keywords[:3]:
                if nk.lower() not in existing_terms:
                    kwlist.append(
                        {
                            "term": nk,
                            "category": "auto_added",
                            "frequency": "weekly",
                            "auto_added": True,
                            "added_date": today,
                        }
                    )
                    existing_terms.add(nk.lower())
                    changed = True

    elif gap_type == "missing_x_account":
        handle = extras.get("x_handle")
        if handle:
            accounts = sources.setdefault("x_accounts", [])
            # 重複確認（大小文字無視）
            existing = {(a or {}).get("handle", "").lower() for a in accounts}
            if handle.lower() not in existing:
                accounts.append(
                    {
                        "handle": handle,
                        "category": "auto_added",
                        "note": note,
                        "priority": "normal",
                        "auto_added": True,
                        "added_date": today,
                    }
                )
                changed = True

    return changed


# ── Supabase I/O ───────────────────────────────────────────────────
def sb_query(sql: str, timeout: float = 30.0) -> list[dict[str, Any]] | None:
    """Management API で SQL を実行。None を返すと通信不能."""
    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    proj = os.environ.get("SUPABASE_PROJECT_REF", "akycymnahqypmtsfqhtr")
    if not token:
        print(
            "[gap-analysis] SUPABASE_ACCESS_TOKEN 未設定。Supabase アクセスをスキップ",
            file=sys.stderr,
        )
        return None
    try:
        resp = requests.post(
            f"https://api.supabase.com/v1/projects/{proj}/database/query",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={"query": sql},
            timeout=timeout,
        )
    except requests.RequestException as e:
        print(f"[gap-analysis] Supabase query エラー: {e}", file=sys.stderr)
        return None

    if not resp.ok:
        body = (resp.text or "")[:200]
        print(
            f"[gap-analysis] Supabase query HTTP {resp.status_code}: {body}",
            file=sys.stderr,
        )
        return None
    try:
        data = resp.json()
    except ValueError:
        return None
    return data if isinstance(data, list) else None


def sb_patch(
    table: str,
    query_params: str,
    payload: dict[str, Any],
    timeout: float = 30.0,
) -> bool:
    """REST PATCH。成功/失敗を bool で返す。"""
    url = os.environ.get("SUPABASE_URL")
    anon = os.environ.get("SUPABASE_ANON_KEY")
    ikey = os.environ.get("SUPABASE_INGEST_KEY", "")
    if not url or not anon:
        return False
    try:
        resp = requests.patch(
            f"{url}/rest/v1/{table}{query_params}",
            headers={
                "apikey": anon,
                "Authorization": f"Bearer {anon}",
                "Content-Type": "application/json",
                "x-ingest-key": ikey,
                "Prefer": "return=minimal",
            },
            json=payload,
            timeout=timeout,
        )
    except requests.RequestException as e:
        print(f"[gap-analysis] PATCH {table} エラー: {e}", file=sys.stderr)
        return False

    if resp.status_code in (200, 204):
        return True
    body = (resp.text or "")[:200]
    print(
        f"[gap-analysis] PATCH {table} HTTP {resp.status_code}: {body}",
        file=sys.stderr,
    )
    return False


# ── ローカルキャッシュ ────────────────────────────────────────────
def load_cache() -> list[dict[str, Any]]:
    if not CACHE_FILE.exists():
        return []
    try:
        with CACHE_FILE.open("r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        articles = data.get("articles", []) if isinstance(data, dict) else []
        return [a for a in articles if isinstance(a, dict)]
    except Exception as e:
        print(f"[gap-analysis] cache 読込エラー: {e}", file=sys.stderr)
        return []


def save_cache(articles: list[dict[str, Any]]) -> None:
    try:
        CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with CACHE_FILE.open("w", encoding="utf-8") as f:
            yaml.safe_dump(
                {"articles": articles},
                f,
                allow_unicode=True,
                sort_keys=False,
            )
    except Exception as e:
        print(f"[gap-analysis] cache 書込エラー: {e}", file=sys.stderr)


# ── sources.yaml 読み書き ─────────────────────────────────────────
def load_sources(path: Path = SOURCES_FILE) -> dict:
    if not path.exists():
        return {}
    try:
        with path.open("r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        return data if isinstance(data, dict) else {}
    except Exception as e:
        print(f"[gap-analysis] sources.yaml 読込エラー: {e}", file=sys.stderr)
        return {}


def save_sources(sources: dict, path: Path = SOURCES_FILE) -> bool:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8") as f:
            yaml.safe_dump(
                sources,
                f,
                allow_unicode=True,
                sort_keys=False,
                width=1000,
            )
        return True
    except Exception as e:
        print(f"[gap-analysis] sources.yaml 書込エラー: {e}", file=sys.stderr)
        return False


# ── メイン ─────────────────────────────────────────────────────────
def fetch_articles() -> tuple[list[dict[str, Any]], bool]:
    """interest_articles を取得する。戻り値 (articles, from_supabase).

    Supabase に接続できた場合は結果を cache にも書き戻す（オフライン時のために）。
    接続できなかった場合は cache からフォールバック。
    """
    sql = (
        "SELECT id, url, title, notes FROM interest_articles "
        "WHERE analyzed=false ORDER BY created_at ASC LIMIT 50"
    )
    rows = sb_query(sql)
    if rows is None:
        cached = load_cache()
        print(
            f"[gap-analysis] Supabase unreachable。cache から {len(cached)} 件読み込み",
            file=sys.stderr,
        )
        return cached, False

    articles: list[dict[str, Any]] = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        if not r.get("url"):
            continue
        articles.append(
            {
                "id": r.get("id"),
                "url": r.get("url"),
                "title": r.get("title"),
                "notes": r.get("notes"),
            }
        )

    # Supabase 成功時は cache にも保存（次回オフライン時用）
    save_cache(articles)
    return articles, True


def main(argv: list[str] | None = None) -> int:  # noqa: ARG001 (CLI 引数不要)
    articles, from_supabase = fetch_articles()
    print(f"[gap-analysis] interest_articles: {len(articles)}件 未分析")
    if not articles:
        return 0

    sources = load_sources()
    if not sources:
        print(
            "[gap-analysis] sources.yaml が空/未存在。分析はスキップ",
            file=sys.stderr,
        )
        return 0

    added_entries = 0
    analyzed_ids: list[tuple[str, dict[str, Any]]] = []  # (id, patch_payload)

    for art in articles:
        url = art.get("url") or ""
        title = art.get("title") or ""

        try:
            gap_type, reason, extras = classify_gap(url, title, sources)
        except Exception as e:
            print(f"[gap-analysis] {url} 分類失敗: {e}", file=sys.stderr)
            continue

        # 更新実行
        added = False
        try:
            if gap_type != "already_covered":
                added = apply_update_to_sources(sources, url, title, gap_type, extras)
        except Exception as e:
            print(
                f"[gap-analysis] {url} sources.yaml 更新中エラー: {e}",
                file=sys.stderr,
            )

        if added:
            added_entries += 1

        # ログ出力
        print(f"[gap-analysis] {url} → {gap_type}{' → 追加' if added else ''}")

        # PATCH ペイロード準備
        aid = art.get("id")
        if aid:
            analyzed_ids.append(
                (
                    str(aid),
                    {
                        "analyzed": True,
                        "gap_type": gap_type,
                        "gap_reason": reason,
                        "added_to_sources": bool(added),
                    },
                )
            )

    # sources.yaml 保存（追加があった場合のみ）
    if added_entries > 0:
        ok = save_sources(sources)
        if ok:
            print(f"[gap-analysis] sources.yaml 更新: +{added_entries} エントリ")
        else:
            print(
                "[gap-analysis] sources.yaml 書き込み失敗。PATCH は続行",
                file=sys.stderr,
            )
    else:
        print("[gap-analysis] sources.yaml 更新なし")

    # Supabase PATCH（接続可の場合のみ）
    patched = 0
    if from_supabase and analyzed_ids:
        for aid, payload in analyzed_ids:
            if sb_patch("interest_articles", f"?id=eq.{aid}", payload):
                patched += 1
        print(f"[gap-analysis] interest_articles PATCH: {patched}件 analyzed=true")
    elif analyzed_ids:
        print(
            f"[gap-analysis] オフラインのため PATCH スキップ ({len(analyzed_ids)}件)",
            file=sys.stderr,
        )

    return 0


if __name__ == "__main__":
    sys.exit(main())
