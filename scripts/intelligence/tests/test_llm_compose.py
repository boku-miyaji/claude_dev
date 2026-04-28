"""llm_compose の単体テスト。

claude CLI subprocess は mock 化。テスト対象は副次ロジックのみ。
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

from llm_compose import (
    compose_report_markdown,
    collect_previous_urls,
    _items_to_context,
)


class TestItemsToContext:
    def test_returns_valid_json(self):
        items = [{"title": "T", "url": "https://a", "published_at": "2026-04-28T00:00:00+00:00"}]
        keywords = ["foo", "bar"]
        ctx = _items_to_context(items, keywords)
        parsed = json.loads(ctx)
        assert parsed["dynamic_keywords"] == ["foo", "bar"]
        assert parsed["items"][0]["url"] == "https://a"


class TestComposeReportMarkdown:
    def test_returns_stdout_when_claude_succeeds(self):
        target = datetime(2026, 4, 28, 9, 0, tzinfo=timezone.utc)
        items = [{"title": "T", "url": "https://a", "source_type": "official_blog",
                  "published_at": "2026-04-28T00:00:00+00:00", "summary": ""}]
        fake_proc = MagicMock(returncode=0, stdout="# 情報収集レポート - 2026-04-28\n" + "x" * 300, stderr="")
        with patch("llm_compose.subprocess.run", return_value=fake_proc) as run_mock:
            result = compose_report_markdown(
                items=items,
                dynamic_keywords=[],
                window_label="Step 1: 直近24時間",
                n_items=1,
                target_date=target,
            )
        assert result is not None
        assert "情報収集レポート" in result
        # claude CLI が opus で呼ばれている
        args = run_mock.call_args[0][0]
        assert "claude" in args[0]
        assert "--model" in args
        assert "claude-opus-4-7" in args

    def test_returns_none_on_nonzero_returncode(self):
        target = datetime(2026, 4, 28, 9, 0, tzinfo=timezone.utc)
        fake_proc = MagicMock(returncode=1, stdout="", stderr="boom")
        with patch("llm_compose.subprocess.run", return_value=fake_proc):
            result = compose_report_markdown(
                items=[], dynamic_keywords=[], window_label="x", n_items=0, target_date=target,
            )
        assert result is None

    def test_returns_none_when_output_too_short(self):
        target = datetime(2026, 4, 28, 9, 0, tzinfo=timezone.utc)
        fake_proc = MagicMock(returncode=0, stdout="too short", stderr="")
        with patch("llm_compose.subprocess.run", return_value=fake_proc):
            result = compose_report_markdown(
                items=[], dynamic_keywords=[], window_label="x", n_items=0, target_date=target,
            )
        assert result is None

    def test_returns_none_when_claude_not_found(self):
        target = datetime(2026, 4, 28, 9, 0, tzinfo=timezone.utc)
        with patch("llm_compose.subprocess.run", side_effect=FileNotFoundError):
            result = compose_report_markdown(
                items=[], dynamic_keywords=[], window_label="x", n_items=0, target_date=target,
            )
        assert result is None


class TestCollectPreviousUrls:
    def test_extracts_from_new_schema(self, tmp_path: Path):
        d = tmp_path / "reports"
        d.mkdir()
        (d / "2026-04-27-0900.json").write_text(json.dumps({
            "items": [
                {"url": "https://a", "title": "A"},
                {"url": "https://b/", "title": "B"},  # 末尾スラッシュは正規化される
            ],
        }), encoding="utf-8")
        urls = collect_previous_urls(d, lookback_days=30)
        assert "https://a" in urls
        assert "https://b" in urls

    def test_extracts_from_old_schema(self, tmp_path: Path):
        d = tmp_path / "reports"
        d.mkdir()
        (d / "2026-04-26.json").write_text(json.dumps({
            "collections": [
                {"results": [{"url": "https://x"}, {"url": "https://y"}]},
            ],
        }), encoding="utf-8")
        urls = collect_previous_urls(d, lookback_days=30)
        assert urls == {"https://x", "https://y"}

    def test_empty_dir_returns_empty(self, tmp_path: Path):
        d = tmp_path / "reports"
        d.mkdir()
        assert collect_previous_urls(d, lookback_days=30) == set()

    def test_nonexistent_dir_returns_empty(self, tmp_path: Path):
        assert collect_previous_urls(tmp_path / "missing", lookback_days=30) == set()
