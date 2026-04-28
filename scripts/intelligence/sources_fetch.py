"""公式ブログ RSS / arXiv API を取得するモジュール。

設計:
  - 各社公式ブログは RSS / Atom feed を feedparser で取得（HTML スクレイピング回避）
  - arXiv は公式 REST API (arxiv.org/api/query) を arxiv lib 経由で取得
  - すべての fetch 結果を統一スキーマ (FetchedItem) に正規化
  - published_at は UTC datetime (tz-aware) で保持。フィルタリングはここでは行わない

使用箇所: collect.py が main orchestrator として呼び出す。
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Iterable

import feedparser
import requests
from dateutil import parser as dateparser

logger = logging.getLogger(__name__)

# 各社公式ブログの RSS / Atom フィード一覧。
# sources.yaml の web_sources に対応する RSS が公開されているものをハードコード。
# RSS が無いソースはここに含めない（HTML スクレイピングはハルシ温床なので避ける）。
OFFICIAL_FEEDS: list[dict] = [
    {
        "name": "Anthropic News",
        "url": "https://www.anthropic.com/news/rss.xml",
        "source_type": "official_blog",
        "vendor": "Anthropic",
    },
    {
        "name": "OpenAI Blog",
        "url": "https://openai.com/blog/rss.xml",
        "source_type": "official_blog",
        "vendor": "OpenAI",
    },
    {
        "name": "Google AI Blog",
        "url": "https://blog.google/technology/ai/rss/",
        "source_type": "official_blog",
        "vendor": "Google",
    },
    {
        "name": "Google DeepMind",
        "url": "https://deepmind.google/blog/rss.xml",
        "source_type": "official_blog",
        "vendor": "DeepMind",
    },
    {
        "name": "Meta AI",
        "url": "https://ai.meta.com/blog/rss/",
        "source_type": "official_blog",
        "vendor": "Meta",
    },
    {
        "name": "Hugging Face Blog",
        "url": "https://huggingface.co/blog/feed.xml",
        "source_type": "official_blog",
        "vendor": "HuggingFace",
    },
]

# arXiv のカテゴリ。sources.yaml の academic_papers.arxiv.categories と同期させる。
# このスクリプトは sources.yaml を尊重するため、external 引数で上書き可能。
ARXIV_CATEGORIES_DEFAULT = ["cs.AI", "cs.CL", "cs.LG", "cs.MA", "cs.SE"]
ARXIV_KEYWORDS_DEFAULT = [
    "LLM agent",
    "code generation LLM",
    "memory augmented LLM",
    "agentic coding",
    "Claude Code",
]


@dataclass
class FetchedItem:
    """取得アイテムの統一スキーマ。

    すべての source 種別で共通のフィールドを持つ。
    24h フィルタや前回差分はこの shape を前提にしている。
    """

    title: str
    url: str
    source_type: str  # "official_blog" | "arxiv" | "keyword_search" | "x_account"
    source_name: str  # 例: "Anthropic News", "arxiv:cs.CL"
    published_at: datetime  # tz-aware UTC. 不明の場合は now() を入れる
    summary: str = ""
    vendor: str = ""  # 例: "Anthropic", "Meta"。official_blog 用
    extra: dict = field(default_factory=dict)  # arxiv の場合は arxiv_id を入れる等

    def to_dict(self) -> dict:
        """JSON シリアライズ用。datetime は ISO 文字列化。"""
        d = asdict(self)
        d["published_at"] = self.published_at.isoformat()
        return d


def _parse_datetime(value) -> datetime | None:
    """feedparser の published_parsed や ISO 文字列を tz-aware datetime に。"""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        try:
            dt = dateparser.parse(value)
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except (ValueError, TypeError):
            return None
    # feedparser の time.struct_time
    if hasattr(value, "tm_year"):
        try:
            return datetime(*value[:6], tzinfo=timezone.utc)
        except (TypeError, ValueError):
            return None
    return None


def fetch_official_feeds(
    feeds: list[dict] | None = None,
    timeout: int = 15,
    per_feed_limit: int = 20,
) -> list[FetchedItem]:
    """公式ブログ RSS を巡回して FetchedItem のリストを返す。

    エラーは個別 feed 単位で握りつぶす（1社ダウンしても全体を落とさない）。
    フィルタリングはここでは行わない。日付チェックは呼び出し側の責務。
    """
    feeds = feeds if feeds is not None else OFFICIAL_FEEDS
    results: list[FetchedItem] = []

    for feed_def in feeds:
        url = feed_def["url"]
        name = feed_def["name"]
        try:
            # feedparser に直接 URL を渡すと内部で http 取得するが、
            # タイムアウトが効かないので requests で先に取得しておく。
            resp = requests.get(url, timeout=timeout, headers={"User-Agent": "intelligence-bot/1.0"})
            resp.raise_for_status()
            parsed = feedparser.parse(resp.content)
        except Exception as e:
            logger.warning("feed fetch failed: %s (%s)", name, e)
            continue

        if parsed.bozo and not parsed.entries:
            logger.warning("feed parse failed: %s (bozo=%s)", name, parsed.bozo_exception)
            continue

        for entry in parsed.entries[:per_feed_limit]:
            published = _parse_datetime(entry.get("published_parsed") or entry.get("updated_parsed") or entry.get("published"))
            if published is None:
                # 日付不明は捨てる。「いつのか分からない記事」を最新として並べない。
                continue
            link = entry.get("link", "").strip()
            title = entry.get("title", "").strip()
            if not link or not title:
                continue
            summary = (entry.get("summary") or entry.get("description") or "").strip()
            if len(summary) > 800:
                summary = summary[:800] + "..."
            results.append(
                FetchedItem(
                    title=title,
                    url=link,
                    source_type=feed_def.get("source_type", "official_blog"),
                    source_name=name,
                    published_at=published,
                    summary=summary,
                    vendor=feed_def.get("vendor", ""),
                )
            )

    return results


def fetch_arxiv(
    categories: list[str] | None = None,
    keywords: list[str] | None = None,
    max_per_query: int = 15,
) -> list[FetchedItem]:
    """arXiv API でカテゴリ + キーワード横断で新着を取得する。

    arxiv lib は内部で公式 REST API (export.arxiv.org/api/query) を叩く。
    レート制限のため per_query を控えめに、キーワード数を絞る前提。
    """
    try:
        import arxiv
    except ImportError:
        logger.error("arxiv lib not installed; skipping arxiv fetch")
        return []

    categories = categories or ARXIV_CATEGORIES_DEFAULT
    keywords = keywords or ARXIV_KEYWORDS_DEFAULT
    results: list[FetchedItem] = []
    seen_ids: set[str] = set()

    client = arxiv.Client(page_size=max_per_query, delay_seconds=3, num_retries=3)

    # クエリ: カテゴリ × キーワードの組み合わせを作る。
    # 全部やると爆発するので、各カテゴリで上位キーワード 1-2 個に絞る。
    queries: list[str] = []
    for cat in categories:
        # 各カテゴリで「カテゴリのみ」のクエリ（直近のもの）
        queries.append(f"cat:{cat}")
    for kw in keywords[:5]:  # キーワードは上位5個まで
        queries.append(f'all:"{kw}"')

    for q in queries:
        try:
            search = arxiv.Search(
                query=q,
                max_results=max_per_query,
                sort_by=arxiv.SortCriterion.SubmittedDate,
                sort_order=arxiv.SortOrder.Descending,
            )
            for paper in client.results(search):
                arxiv_id = paper.get_short_id()
                if arxiv_id in seen_ids:
                    continue
                seen_ids.add(arxiv_id)
                published = paper.published
                if published.tzinfo is None:
                    published = published.replace(tzinfo=timezone.utc)
                summary = (paper.summary or "").strip().replace("\n", " ")
                if len(summary) > 800:
                    summary = summary[:800] + "..."
                results.append(
                    FetchedItem(
                        title=paper.title.strip(),
                        url=paper.entry_id,  # arxiv.org/abs/XXXX.XXXXX
                        source_type="arxiv",
                        source_name=f"arxiv:{q}",
                        published_at=published,
                        summary=summary,
                        vendor="arXiv",
                        extra={
                            "arxiv_id": arxiv_id,
                            "categories": [c for c in (paper.categories or [])],
                            "authors": [a.name for a in (paper.authors or [])][:8],
                        },
                    )
                )
        except Exception as e:
            logger.warning("arxiv query failed: %s (%s)", q, e)
            continue

    return results


def filter_by_window(
    items: Iterable[FetchedItem],
    *,
    now: datetime,
    hours: int,
) -> list[FetchedItem]:
    """published_at が now から hours 時間以内のアイテムのみ返す。"""
    from datetime import timedelta

    threshold = now - timedelta(hours=hours)
    return [it for it in items if it.published_at >= threshold]


def select_window_with_fallback(
    items: list[FetchedItem],
    *,
    now: datetime,
    min_items: int = 3,
) -> tuple[str, int, list[FetchedItem]]:
    """24h で十分なら 24h、足りなければ段階的に遡る。

    戻り値: (window_label, hours, filtered_items)
    """
    stages = [(24, "Step 1: 直近24時間"), (72, "Step 2a: 直近3日"), (168, "Step 2b: 直近1週間"), (336, "Step 2c: 直近2週間")]
    for hours, label in stages:
        filtered = filter_by_window(items, now=now, hours=hours)
        if len(filtered) >= min_items:
            return (label, hours, filtered)
    # 2週間遡っても min_items 未満 → そのまま返す（呼び出し側で「特筆すべき新規情報なし」を出す）
    filtered = filter_by_window(items, now=now, hours=336)
    return ("Step 3: 直近2週間でも新規少なし", 336, filtered)


def dedupe_against_previous(
    items: list[FetchedItem],
    previous_urls: set[str],
) -> list[FetchedItem]:
    """前回までのレポートに含まれた URL を除外する（差分のみ返す）。"""
    out: list[FetchedItem] = []
    for it in items:
        # 末尾スラッシュ等の正規化
        url = it.url.rstrip("/")
        if url in previous_urls or it.url in previous_urls:
            continue
        out.append(it)
    return out
