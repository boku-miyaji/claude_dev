"""gap_analysis の単体テスト。"""
from __future__ import annotations

import copy
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

import gap_analysis as ga


# ── 最小の sources.yaml フィクスチャ ────────────────────────────────
@pytest.fixture
def sample_sources() -> dict:
    """既存の sources.yaml に近い最小構造を返す（テスト用にコピー安全）."""
    return copy.deepcopy({
        "x_accounts": [
            {"handle": "@AnthropicAI", "category": "AI", "priority": "high"},
            {"handle": "@OpenAI", "category": "AI", "priority": "high"},
        ],
        "keywords": [
            {"term": "Claude Code", "category": "AI tools", "frequency": "daily"},
            {"term": "MCP server", "category": "AI tools", "frequency": "daily"},
        ],
        "web_sources": [
            {
                "url": "https://www.anthropic.com/news",
                "category": "AI",
                "name": "Anthropic Blog",
                "frequency": "daily",
            },
        ],
        "tech_articles": [
            {
                "site": "zenn.dev",
                "name": "Zenn",
                "keywords": ["Claude Code", "MCP"],
                "frequency": "daily",
            },
            {
                "site": "dev.to",
                "name": "Dev.to",
                "keywords": ["Claude Code", "AI agent"],
                "frequency": "daily",
            },
        ],
        "academic_papers": {
            "arxiv": {
                "categories": ["cs.AI"],
                "keywords": [
                    {"term": "LLM agent", "frequency": "daily"},
                ],
            },
        },
    })


# ── extract_domain ─────────────────────────────────────────────────
class TestExtractDomain:
    def test_basic(self):
        assert ga.extract_domain("https://zenn.dev/mizchi/articles/xxx") == "zenn.dev"

    def test_www_stripped(self):
        assert ga.extract_domain("https://www.anthropic.com/news") == "anthropic.com"

    def test_empty_on_invalid(self):
        assert ga.extract_domain("not a url") == ""

    def test_case_insensitive(self):
        assert ga.extract_domain("https://ZENN.DEV/foo") == "zenn.dev"


# ── extract_x_handle ───────────────────────────────────────────────
class TestExtractXHandle:
    def test_basic_x_com(self):
        assert ga.extract_x_handle("https://x.com/elonmusk/status/123") == "@elonmusk"

    def test_twitter_com(self):
        assert ga.extract_x_handle("https://twitter.com/AnthropicAI") == "@AnthropicAI"

    def test_at_prefix_allowed(self):
        assert ga.extract_x_handle("https://x.com/@someone") == "@someone"

    def test_non_x_returns_none(self):
        assert ga.extract_x_handle("https://zenn.dev/foo") is None

    def test_reserved_path_returns_none(self):
        assert ga.extract_x_handle("https://x.com/home") is None
        assert ga.extract_x_handle("https://x.com/i/spaces/xxx") is None


# ── extract_keywords ───────────────────────────────────────────────
class TestExtractKeywords:
    def test_english_words(self):
        kws = ga.extract_keywords("Understanding LLM Agents with MCP")
        # 'the', 'with' のようなストップワードは除外される
        lower_kws = [k.lower() for k in kws]
        assert "understanding" in lower_kws
        assert "llm" in lower_kws
        assert "agents" in lower_kws
        assert "mcp" in lower_kws
        assert "with" not in lower_kws

    def test_japanese_phrases(self):
        kws = ga.extract_keywords("AIエージェントの設計と実装")
        # 日本語の塊が拾えること（1 文字の「と」は拾わない）
        joined = "".join(kws)
        assert "AI" in kws  # 英語部分
        # カタカナ連続が取れる
        assert any("エージェント" in k for k in kws)

    def test_empty(self):
        assert ga.extract_keywords(None) == []
        assert ga.extract_keywords("") == []

    def test_deduplicates(self):
        # 同じ単語は重複しない
        kws = ga.extract_keywords("LLM LLM LLM test TEST Test")
        lowered = [k.lower() for k in kws]
        assert lowered.count("llm") == 1
        assert lowered.count("test") == 1

    def test_short_tokens_skipped(self):
        # 1 文字は拾わない
        kws = ga.extract_keywords("a b c dog cat")
        lowered = [k.lower() for k in kws]
        assert "dog" in lowered
        assert "cat" in lowered
        assert "a" not in lowered


# ── domain_in_sources / x_handle_in_sources ────────────────────────
class TestDomainInSources:
    def test_domain_in_tech_articles(self, sample_sources):
        assert ga.domain_in_sources("zenn.dev", sample_sources) is True

    def test_domain_in_web_sources(self, sample_sources):
        assert ga.domain_in_sources("anthropic.com", sample_sources) is True

    def test_domain_missing(self, sample_sources):
        assert ga.domain_in_sources("newsite.example.com", sample_sources) is False

    def test_empty_domain(self, sample_sources):
        assert ga.domain_in_sources("", sample_sources) is False


class TestXHandleInSources:
    def test_found(self, sample_sources):
        assert ga.x_handle_in_sources("@AnthropicAI", sample_sources) is True

    def test_missing(self, sample_sources):
        assert ga.x_handle_in_sources("@Unknown", sample_sources) is False

    def test_case_insensitive(self, sample_sources):
        assert ga.x_handle_in_sources("@anthropicai", sample_sources) is True


# ── classify_gap ───────────────────────────────────────────────────
class TestClassifyGap:
    def test_already_covered(self, sample_sources):
        gap_type, _reason, _extras = ga.classify_gap(
            "https://zenn.dev/mizchi/articles/claude-code-mcp",
            "Claude Code で MCP を使う",
            sample_sources,
        )
        assert gap_type == "already_covered"

    def test_missing_domain(self, sample_sources):
        gap_type, reason, extras = ga.classify_gap(
            "https://newsite.example.com/article/foo",
            "Some new article",
            sample_sources,
        )
        assert gap_type == "missing_domain"
        assert "newsite.example.com" in reason
        assert extras["domain"] == "newsite.example.com"

    def test_missing_keyword(self, sample_sources):
        # zenn.dev は登録済み、タイトルのキーワード "Playwright" は未登録
        gap_type, _reason, extras = ga.classify_gap(
            "https://zenn.dev/mizchi/articles/playwright-e2e",
            "Playwright で E2E テストを書く",
            sample_sources,
        )
        assert gap_type == "missing_keyword"
        # new_keywords に Playwright 相当が含まれる（大小文字を問わず）
        assert any("playwright" == k.lower() for k in extras["new_keywords"])

    def test_missing_x_account(self, sample_sources):
        gap_type, reason, extras = ga.classify_gap(
            "https://x.com/someNewPerson/status/123",
            "tweet",
            sample_sources,
        )
        assert gap_type == "missing_x_account"
        assert extras["x_handle"] == "@someNewPerson"
        assert "someNewPerson" in reason

    def test_existing_x_account(self, sample_sources):
        gap_type, _reason, _extras = ga.classify_gap(
            "https://x.com/AnthropicAI/status/123",
            "tweet",
            sample_sources,
        )
        assert gap_type == "already_covered"

    def test_arxiv_missing_domain(self, sample_sources):
        # arxiv.org は web_sources / tech_articles に含まれないので missing_domain
        gap_type, _reason, extras = ga.classify_gap(
            "https://arxiv.org/abs/2402.17753",
            "A new Agent paper",
            sample_sources,
        )
        assert gap_type == "missing_domain"
        assert extras["source_type"] == "academic"


# ── apply_update_to_sources ────────────────────────────────────────
class TestApplyUpdate:
    def test_missing_domain_tech_article(self, sample_sources):
        url = "https://hashnode.dev/foo/bar"
        title = "Hashnode article about Claude"
        gap_type, _, extras = ga.classify_gap(url, title, sample_sources)
        assert gap_type == "missing_domain"

        changed = ga.apply_update_to_sources(sample_sources, url, title, gap_type, extras)
        assert changed is True

        # tech_articles に hashnode.dev が追加されているはず
        sites = [ta.get("site") for ta in sample_sources["tech_articles"]]
        assert "hashnode.dev" in sites
        added = next(ta for ta in sample_sources["tech_articles"] if ta.get("site") == "hashnode.dev")
        assert added["auto_added"] is True
        assert "added_date" in added
        assert "note" in added

    def test_missing_domain_web_source(self, sample_sources):
        url = "https://unknown-blog.example.com/posts/1"
        title = "Unknown blog post"
        gap_type, _, extras = ga.classify_gap(url, title, sample_sources)
        assert gap_type == "missing_domain"

        changed = ga.apply_update_to_sources(sample_sources, url, title, gap_type, extras)
        assert changed is True

        urls = [ws.get("url") for ws in sample_sources["web_sources"]]
        assert any("unknown-blog.example.com" in u for u in urls)

    def test_missing_keyword_adds_to_existing_entry(self, sample_sources):
        url = "https://zenn.dev/mizchi/articles/playwright-guide"
        title = "Playwright E2E テスト入門"
        gap_type, _, extras = ga.classify_gap(url, title, sample_sources)
        assert gap_type == "missing_keyword"

        before_kws = list(
            next(ta for ta in sample_sources["tech_articles"] if ta["site"] == "zenn.dev")["keywords"]
        )
        changed = ga.apply_update_to_sources(sample_sources, url, title, gap_type, extras)
        assert changed is True

        after_entry = next(ta for ta in sample_sources["tech_articles"] if ta["site"] == "zenn.dev")
        assert len(after_entry["keywords"]) > len(before_kws)
        # Playwright（大小文字問わず）が含まれる
        assert any(
            "playwright" == str(k).lower() for k in after_entry["keywords"]
        )

    def test_missing_keyword_no_op_if_all_exists(self, sample_sources):
        # 全部すでに sources に存在するキーワードのみの場合は変更なし
        # extras の new_keywords を空にして渡す
        url = "https://zenn.dev/foo"
        title = "Claude Code MCP"
        extras = {
            "domain": "zenn.dev",
            "source_type": "tech_article",
            "x_handle": None,
            "keywords": ["Claude Code", "MCP"],
            "new_keywords": [],
        }
        changed = ga.apply_update_to_sources(sample_sources, url, title, "missing_keyword", extras)
        assert changed is False

    def test_missing_x_account_adds(self, sample_sources):
        url = "https://x.com/newPerson/status/1"
        title = "hello world"
        gap_type, _, extras = ga.classify_gap(url, title, sample_sources)
        assert gap_type == "missing_x_account"

        changed = ga.apply_update_to_sources(sample_sources, url, title, gap_type, extras)
        assert changed is True

        handles = [a.get("handle") for a in sample_sources["x_accounts"]]
        assert "@newPerson" in handles

    def test_missing_x_account_no_dup(self, sample_sources):
        # 既存 handle を追加しようとしても重複しない
        extras = {
            "domain": "x.com",
            "source_type": "x_account",
            "x_handle": "@AnthropicAI",
            "keywords": [],
            "new_keywords": [],
        }
        before = len(sample_sources["x_accounts"])
        changed = ga.apply_update_to_sources(
            sample_sources,
            "https://x.com/AnthropicAI/status/1",
            "tweet",
            "missing_x_account",
            extras,
        )
        assert changed is False
        assert len(sample_sources["x_accounts"]) == before


# ── sources.yaml I/O（tmp_path 利用）────────────────────────────────
class TestSourcesIO:
    def test_save_and_load_roundtrip(self, tmp_path, sample_sources):
        p = tmp_path / "sources.yaml"
        ok = ga.save_sources(sample_sources, path=p)
        assert ok is True
        reloaded = ga.load_sources(path=p)
        assert reloaded.get("x_accounts") == sample_sources["x_accounts"]
        assert reloaded.get("tech_articles") == sample_sources["tech_articles"]

    def test_load_missing(self, tmp_path):
        p = tmp_path / "does_not_exist.yaml"
        assert ga.load_sources(path=p) == {}


# ── main のエンドツーエンド（モック）──────────────────────────────
class TestMainFlow:
    def test_no_articles(self, tmp_path, monkeypatch, sample_sources):
        """interest_articles が空 → 何もしない."""
        monkeypatch.setattr(ga, "fetch_articles", lambda: ([], True))
        ret = ga.main()
        assert ret == 0

    def test_articles_patch_flow(self, tmp_path, monkeypatch, sample_sources):
        """Supabase 接続成功 → sources.yaml 更新 + PATCH."""
        # 一時 sources.yaml に切り替え
        p = tmp_path / "sources.yaml"
        ga.save_sources(sample_sources, path=p)
        monkeypatch.setattr(ga, "SOURCES_FILE", p)

        articles = [
            {
                "id": "uuid-1",
                "url": "https://hashnode.dev/foo/bar",
                "title": "Hashnode article",
                "notes": "",
            },
            {
                "id": "uuid-2",
                "url": "https://zenn.dev/mizchi/articles/claude-code-mcp",
                "title": "Claude Code で MCP",
                "notes": "",
            },
        ]
        monkeypatch.setattr(ga, "fetch_articles", lambda: (articles, True))

        # load_sources は SOURCES_FILE のモンキーパッチを見るので OK
        patches: list[tuple[str, str, dict]] = []

        def fake_patch(table, query_params, payload, timeout=30.0):
            patches.append((table, query_params, payload))
            return True

        monkeypatch.setattr(ga, "sb_patch", fake_patch)

        ret = ga.main()
        assert ret == 0

        # 2 件とも PATCH された（1件は missing_domain、1件は already_covered）
        assert len(patches) == 2
        # 1 件目は added_to_sources=True
        paid1 = next(p for t, q, p in patches if "uuid-1" in q)
        assert paid1["analyzed"] is True
        assert paid1["gap_type"] == "missing_domain"
        assert paid1["added_to_sources"] is True
        # 2 件目は already_covered かつ added_to_sources=False
        paid2 = next(p for t, q, p in patches if "uuid-2" in q)
        assert paid2["gap_type"] == "already_covered"
        assert paid2["added_to_sources"] is False

        # sources.yaml に hashnode.dev が追加されている
        reloaded = ga.load_sources(path=p)
        sites = [ta.get("site") for ta in reloaded.get("tech_articles", [])]
        assert "hashnode.dev" in sites

    def test_offline_fallback(self, tmp_path, monkeypatch, sample_sources):
        """Supabase unreachable → PATCH はスキップ、sources.yaml 更新は続行."""
        p = tmp_path / "sources.yaml"
        ga.save_sources(sample_sources, path=p)
        monkeypatch.setattr(ga, "SOURCES_FILE", p)

        cached = [
            {
                "id": "uuid-off",
                "url": "https://hashnode.dev/foo",
                "title": "cached article",
                "notes": None,
            },
        ]
        monkeypatch.setattr(ga, "fetch_articles", lambda: (cached, False))

        patch_called = {"n": 0}

        def fake_patch(*_a, **_k):
            patch_called["n"] += 1
            return True

        monkeypatch.setattr(ga, "sb_patch", fake_patch)

        ret = ga.main()
        assert ret == 0

        # PATCH は呼ばれない（オフライン）
        assert patch_called["n"] == 0

        # sources.yaml は更新される
        reloaded = ga.load_sources(path=p)
        sites = [ta.get("site") for ta in reloaded.get("tech_articles", [])]
        assert "hashnode.dev" in sites


# ── Supabase 通信のエラーハンドリング ───────────────────────────────
class TestSupabaseErrors:
    def test_sb_query_without_token(self, monkeypatch):
        monkeypatch.delenv("SUPABASE_ACCESS_TOKEN", raising=False)
        assert ga.sb_query("SELECT 1") is None

    def test_sb_query_timeout(self, monkeypatch):
        monkeypatch.setenv("SUPABASE_ACCESS_TOKEN", "test")
        with patch("gap_analysis.requests.post") as mock_post:
            import requests as _rq
            mock_post.side_effect = _rq.Timeout("timeout")
            assert ga.sb_query("SELECT 1") is None

    def test_sb_patch_without_env(self, monkeypatch):
        monkeypatch.delenv("SUPABASE_URL", raising=False)
        monkeypatch.delenv("SUPABASE_ANON_KEY", raising=False)
        assert ga.sb_patch("tbl", "?id=eq.1", {"x": 1}) is False

    def test_sb_patch_request_exception(self, monkeypatch):
        monkeypatch.setenv("SUPABASE_URL", "https://example.com")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "anon")
        monkeypatch.setenv("SUPABASE_INGEST_KEY", "key")
        with patch("gap_analysis.requests.patch") as mock_patch:
            import requests as _rq
            mock_patch.side_effect = _rq.ConnectionError("boom")
            assert ga.sb_patch("tbl", "?id=eq.1", {"x": 1}) is False

    def test_sb_patch_success(self, monkeypatch):
        monkeypatch.setenv("SUPABASE_URL", "https://example.com")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "anon")
        monkeypatch.setenv("SUPABASE_INGEST_KEY", "key")
        with patch("gap_analysis.requests.patch") as mock_patch:
            mock_resp = MagicMock()
            mock_resp.status_code = 204
            mock_patch.return_value = mock_resp
            assert ga.sb_patch("tbl", "?id=eq.1", {"x": 1}) is True


# ── キャッシュ I/O ────────────────────────────────────────────────
class TestCache:
    def test_save_and_load(self, tmp_path, monkeypatch):
        p = tmp_path / "cache.yaml"
        monkeypatch.setattr(ga, "CACHE_FILE", p)
        articles = [{"id": "1", "url": "https://x", "title": "t", "notes": None}]
        ga.save_cache(articles)
        got = ga.load_cache()
        assert got == articles

    def test_load_missing(self, tmp_path, monkeypatch):
        p = tmp_path / "missing.yaml"
        monkeypatch.setattr(ga, "CACHE_FILE", p)
        assert ga.load_cache() == []
