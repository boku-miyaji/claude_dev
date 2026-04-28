"""sources_fetch の単体テスト。

ネットワーク呼び出しは行わず、フィルタ・差分・段階遡りロジックを単体検証する。
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from sources_fetch import (
    FetchedItem,
    filter_by_window,
    select_window_with_fallback,
    dedupe_against_previous,
    _parse_datetime,
)


@pytest.fixture
def now_utc():
    return datetime(2026, 4, 28, 12, 0, 0, tzinfo=timezone.utc)


def _mk(url: str, hours_ago: float, now: datetime, source_type: str = "official_blog") -> FetchedItem:
    return FetchedItem(
        title=f"item-{url}",
        url=url,
        source_type=source_type,
        source_name="test",
        published_at=now - timedelta(hours=hours_ago),
        summary="",
    )


class TestFilterByWindow:
    def test_returns_only_items_within_window(self, now_utc):
        items = [
            _mk("https://a", 5, now_utc),   # 5h ago: 24h 内
            _mk("https://b", 25, now_utc),  # 25h ago: 24h 外
            _mk("https://c", 10, now_utc),  # 10h ago: 24h 内
        ]
        result = filter_by_window(items, now=now_utc, hours=24)
        urls = sorted(r.url for r in result)
        assert urls == ["https://a", "https://c"]

    def test_empty_input(self, now_utc):
        assert filter_by_window([], now=now_utc, hours=24) == []


class TestSelectWindowWithFallback:
    def test_24h_when_enough(self, now_utc):
        items = [_mk(f"https://x{i}", 5, now_utc) for i in range(5)]
        label, hours, filtered = select_window_with_fallback(items, now=now_utc, min_items=3)
        assert hours == 24
        assert "24時間" in label
        assert len(filtered) == 5

    def test_falls_back_to_72h_when_24h_insufficient(self, now_utc):
        items = [
            _mk("https://a", 5, now_utc),    # 24h 内
            _mk("https://b", 30, now_utc),   # 24h 外, 72h 内
            _mk("https://c", 50, now_utc),   # 24h 外, 72h 内
            _mk("https://d", 60, now_utc),   # 24h 外, 72h 内
        ]
        label, hours, filtered = select_window_with_fallback(items, now=now_utc, min_items=3)
        assert hours == 72
        assert "3日" in label
        assert len(filtered) == 4

    def test_falls_back_to_2weeks_when_all_short_supply(self, now_utc):
        # 全て 7日前で min_items=3 を満たさない（item は1件のみ）
        items = [_mk("https://a", 24 * 7, now_utc)]
        label, hours, filtered = select_window_with_fallback(items, now=now_utc, min_items=3)
        # 1週間以内 1件 → 不足 → 2週間以内も同じ 1 件
        # 結果は最終ラベル「直近2週間」で 1 件
        assert hours == 336
        assert "2週間" in label

    def test_no_items_at_all(self, now_utc):
        label, hours, filtered = select_window_with_fallback([], now=now_utc, min_items=3)
        assert filtered == []
        # 2週間でもアイテム0件なので最終 stage に到達する
        assert "新規少なし" in label


class TestDedupeAgainstPrevious:
    def test_excludes_known_urls(self, now_utc):
        items = [
            _mk("https://known", 5, now_utc),
            _mk("https://new", 5, now_utc),
        ]
        prev = {"https://known"}
        result = dedupe_against_previous(items, prev)
        assert [r.url for r in result] == ["https://new"]

    def test_handles_trailing_slash_normalization(self, now_utc):
        items = [_mk("https://a/", 5, now_utc)]
        prev = {"https://a"}  # 末尾スラッシュなし
        result = dedupe_against_previous(items, prev)
        assert result == []

    def test_empty_previous(self, now_utc):
        items = [_mk("https://a", 5, now_utc), _mk("https://b", 5, now_utc)]
        result = dedupe_against_previous(items, set())
        assert len(result) == 2


class TestParseDatetime:
    def test_iso_string(self):
        dt = _parse_datetime("2026-04-28T12:00:00Z")
        assert dt is not None
        assert dt.tzinfo is not None
        assert dt.year == 2026

    def test_struct_time(self):
        import time
        st = time.strptime("2026-04-28", "%Y-%m-%d")
        dt = _parse_datetime(st)
        assert dt is not None
        assert dt.year == 2026
        assert dt.tzinfo is timezone.utc

    def test_none(self):
        assert _parse_datetime(None) is None

    def test_invalid_string(self):
        assert _parse_datetime("not-a-date-string") is None
