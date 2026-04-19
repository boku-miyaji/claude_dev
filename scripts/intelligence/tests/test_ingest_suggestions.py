"""ingest_suggestions の単体テスト。"""
from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest

import ingest_suggestions as ingest


# ── extract_suggestions_yaml ─────────────────────────────────────
def test_extract_basic_block():
    md = """# Report

## Foo
bar

```yaml
# suggestions
suggestions:
  - title: "Test item"
    description: "desc"
    priority: high
    effort: small
    category: design
    source_urls:
      - https://example.com
```

## handoff
"""
    items = ingest.extract_suggestions_yaml(md)
    assert len(items) == 1
    assert items[0]["title"] == "Test item"
    assert items[0]["priority"] == "high"
    assert items[0]["effort"] == "small"
    assert items[0]["category"] == "design"
    assert items[0]["source_urls"] == ["https://example.com"]


def test_extract_no_marker_still_works_if_top_key_present():
    md = """```yaml
suggestions:
  - title: "Implicit"
    priority: low
    effort: medium
    category: architecture
```"""
    items = ingest.extract_suggestions_yaml(md)
    assert len(items) == 1
    assert items[0]["title"] == "Implicit"


def test_extract_ignores_other_yaml_blocks():
    md = """```yaml
# handoff
handoff:
  - to: pm
    tasks:
      - "not a suggestion"
```

```yaml
# suggestions
suggestions:
  - title: "Real one"
    priority: medium
    effort: medium
    category: ux
```
"""
    items = ingest.extract_suggestions_yaml(md)
    assert len(items) == 1
    assert items[0]["title"] == "Real one"


def test_extract_multiple_items_in_same_block():
    md = """```yaml
# suggestions
suggestions:
  - title: "A"
    priority: high
    effort: large
    category: algorithm
  - title: "B"
    priority: low
    effort: small
    category: cost
```"""
    items = ingest.extract_suggestions_yaml(md)
    assert len(items) == 2
    assert {i["title"] for i in items} == {"A", "B"}


def test_extract_empty_if_no_block():
    md = "Just markdown with no yaml block."
    assert ingest.extract_suggestions_yaml(md) == []


def test_extract_handles_invalid_yaml():
    md = """```yaml
# suggestions
suggestions:
  - title: "OK"
    priority: high
    effort: small
    category: ux
```

```yaml
not: valid: yaml: here
```
"""
    items = ingest.extract_suggestions_yaml(md)
    assert len(items) == 1


def test_normalize_drops_unknown_category_to_other():
    raw = {"title": "Foo", "category": "unknown_category_xyz"}
    norm = ingest._normalize_suggestion(raw)
    assert norm is not None
    assert norm["category"] == "other"


def test_normalize_drops_invalid_priority():
    raw = {"title": "Foo", "priority": "extreme"}
    norm = ingest._normalize_suggestion(raw)
    assert norm is not None
    assert norm["priority"] is None


def test_normalize_requires_title():
    assert ingest._normalize_suggestion({"title": ""}) is None
    assert ingest._normalize_suggestion({}) is None
    assert ingest._normalize_suggestion({"title": None}) is None


def test_normalize_coerces_source_urls_string_to_list():
    raw = {"title": "Foo", "source_urls": "https://a.example"}
    norm = ingest._normalize_suggestion(raw)
    assert norm is not None
    assert norm["source_urls"] == ["https://a.example"]


def test_normalize_empty_source_urls_default():
    raw = {"title": "Foo"}
    norm = ingest._normalize_suggestion(raw)
    assert norm is not None
    assert norm["source_urls"] == []


# ── infer_source_report_path / date ──────────────────────────────
def test_infer_source_report_path_under_company(tmp_path, monkeypatch):
    # 実在する .company パスを模して検証
    fake = Path("/workspace/.company/departments/intelligence/reports/2026-04-19-briefing.md")
    result = ingest.infer_source_report_path(fake)
    assert result == ".company/departments/intelligence/reports/2026-04-19-briefing.md"


def test_infer_source_report_path_fallback_to_name(tmp_path):
    p = tmp_path / "report.md"
    p.write_text("")
    result = ingest.infer_source_report_path(p)
    assert result.endswith("report.md")


def test_infer_source_report_date_from_filename():
    p = Path("2026-04-19-briefing.md")
    assert ingest.infer_source_report_date(p) == "2026-04-19"


def test_infer_source_report_date_invalid_date_returns_none():
    p = Path("2026-13-45-invalid.md")
    assert ingest.infer_source_report_date(p) is None


def test_infer_source_report_date_no_date_returns_none():
    p = Path("briefing.md")
    assert ingest.infer_source_report_date(p) is None


# ── build_insert_payload ─────────────────────────────────────────
def test_build_insert_payload_basic():
    sug = {
        "title": "T",
        "description": "D",
        "priority": "high",
        "effort": "small",
        "category": "ux",
        "source_urls": ["https://x.example"],
    }
    payload = ingest.build_insert_payload(sug, ".company/x.md", "2026-04-19")
    assert payload["title"] == "T"
    assert payload["source_report_path"] == ".company/x.md"
    assert payload["source_report_date"] == "2026-04-19"
    assert payload["status"] == "new"


def test_build_insert_payload_omits_date_when_none():
    sug = {
        "title": "T",
        "description": None,
        "priority": None,
        "effort": None,
        "category": None,
        "source_urls": [],
    }
    payload = ingest.build_insert_payload(sug, ".company/x.md", None)
    assert "source_report_date" not in payload


# ── post_suggestion（モック） ─────────────────────────────────────
class _FakeResp:
    def __init__(self, status_code: int, text: str = ""):
        self.status_code = status_code
        self.text = text


def test_post_suggestion_inserted(monkeypatch):
    captured = {}

    def fake_post(url, headers, json, timeout):
        captured["url"] = url
        captured["headers"] = headers
        captured["json"] = json
        return _FakeResp(201)

    monkeypatch.setattr(ingest.requests, "post", fake_post)

    result, code = ingest.post_suggestion(
        "https://sb.example", "anon", "ikey", {"title": "T"}
    )
    assert result == "inserted"
    assert code == 201
    assert captured["headers"]["x-ingest-key"] == "ikey"
    assert captured["headers"]["apikey"] == "anon"
    assert "Prefer" in captured["headers"]


def test_post_suggestion_duplicate_409(monkeypatch):
    monkeypatch.setattr(
        ingest.requests, "post", lambda *a, **kw: _FakeResp(409, "duplicate key")
    )
    result, _ = ingest.post_suggestion(
        "https://sb.example", "anon", "ikey", {"title": "T"}
    )
    assert result == "duplicate"


def test_post_suggestion_duplicate_23505(monkeypatch):
    monkeypatch.setattr(
        ingest.requests,
        "post",
        lambda *a, **kw: _FakeResp(400, 'error 23505 unique violation'),
    )
    result, _ = ingest.post_suggestion(
        "https://sb.example", "anon", "ikey", {"title": "T"}
    )
    assert result == "duplicate"


def test_post_suggestion_error(monkeypatch, capsys):
    monkeypatch.setattr(
        ingest.requests, "post", lambda *a, **kw: _FakeResp(500, "boom")
    )
    result, code = ingest.post_suggestion(
        "https://sb.example", "anon", "ikey", {"title": "T"}
    )
    assert result == "error"
    assert code == 500


def test_post_suggestion_exception(monkeypatch):
    def raise_it(*a, **kw):
        raise ingest.requests.ConnectionError("nope")

    monkeypatch.setattr(ingest.requests, "post", raise_it)
    result, code = ingest.post_suggestion(
        "https://sb.example", "anon", "ikey", {"title": "T"}
    )
    assert result == "error"
    assert code == 0


class _FakeJsonResp:
    """200 OK + JSON body を返すモック。check_existing 用。"""

    def __init__(self, status_code: int, json_data=None, text: str = ""):
        self.status_code = status_code
        self._json = json_data if json_data is not None else []
        self.text = text

    def json(self):
        return self._json


# ── check_existing ────────────────────────────────────────────────
def test_check_existing_found(monkeypatch):
    captured = {}

    def fake_get(url, headers, params, timeout):
        captured["url"] = url
        captured["params"] = params
        captured["headers"] = headers
        return _FakeJsonResp(200, json_data=[{"id": "abc-123"}])

    monkeypatch.setattr(ingest.requests, "get", fake_get)

    exists = ingest.check_existing(
        "https://sb.example", "anon", "ikey", "Title A", ".company/x.md"
    )
    assert exists is True
    assert captured["params"]["title"] == "eq.Title A"
    assert captured["params"]["source_report_path"] == "eq..company/x.md"
    assert captured["headers"]["x-ingest-key"] == "ikey"


def test_check_existing_not_found(monkeypatch):
    monkeypatch.setattr(
        ingest.requests,
        "get",
        lambda *a, **kw: _FakeJsonResp(200, json_data=[]),
    )
    exists = ingest.check_existing(
        "https://sb.example", "anon", "ikey", "Title B", ".company/y.md"
    )
    assert exists is False


def test_check_existing_http_error_returns_none(monkeypatch):
    monkeypatch.setattr(
        ingest.requests,
        "get",
        lambda *a, **kw: _FakeJsonResp(500, json_data=None, text="boom"),
    )
    exists = ingest.check_existing(
        "https://sb.example", "anon", "ikey", "Title C", ".company/z.md"
    )
    assert exists is None


def test_check_existing_network_error_returns_none(monkeypatch):
    def raise_it(*a, **kw):
        raise ingest.requests.ConnectionError("down")

    monkeypatch.setattr(ingest.requests, "get", raise_it)
    exists = ingest.check_existing(
        "https://sb.example", "anon", "ikey", "Title D", ".company/w.md"
    )
    assert exists is None


# ── run（ファイル→DB 流れのインテグレーション） ──────────────────
def _mock_select_empty(monkeypatch):
    """SELECT は常に「存在しない」を返す。"""
    monkeypatch.setattr(
        ingest.requests,
        "get",
        lambda *a, **kw: _FakeJsonResp(200, json_data=[]),
    )


def _mock_select_exists(monkeypatch):
    """SELECT は常に「既存あり」を返す。"""
    monkeypatch.setattr(
        ingest.requests,
        "get",
        lambda *a, **kw: _FakeJsonResp(200, json_data=[{"id": "exists"}]),
    )


def test_run_full_flow(tmp_path, monkeypatch):
    # テスト用レポート作成
    report = tmp_path / "2026-04-10-briefing.md"
    report.write_text(
        """# Report

## Content
lorem

```yaml
# suggestions
suggestions:
  - title: "From Test"
    description: "desc"
    priority: medium
    effort: medium
    category: algorithm
    source_urls: []
```
""",
        encoding="utf-8",
    )

    _mock_select_empty(monkeypatch)

    calls = []

    def fake_post(url, headers, json, timeout):
        calls.append(json)
        return _FakeResp(201)

    monkeypatch.setattr(ingest.requests, "post", fake_post)

    rc = ingest.run(report, "https://sb.example", "anon", "ikey")
    assert rc == 0
    assert len(calls) == 1
    assert calls[0]["title"] == "From Test"
    assert calls[0]["status"] == "new"
    assert calls[0]["source_report_date"] == "2026-04-10"


def test_run_idempotent_skips_existing(tmp_path, monkeypatch, capsys):
    """同じレポートを2回流しても、2回目は SELECT で弾かれ INSERT されない。"""
    report = tmp_path / "2026-04-11-briefing.md"
    report.write_text(
        """```yaml
# suggestions
suggestions:
  - title: "Only One"
    priority: high
    effort: small
    category: ux
```""",
        encoding="utf-8",
    )

    _mock_select_exists(monkeypatch)

    post_calls = []

    def fake_post(url, headers, json, timeout):
        post_calls.append(json)
        return _FakeResp(201)

    monkeypatch.setattr(ingest.requests, "post", fake_post)

    rc = ingest.run(report, "https://sb.example", "anon", "ikey")
    assert rc == 0
    # SELECT で存在確認されたので POST は呼ばれない
    assert len(post_calls) == 0

    out = capsys.readouterr().out
    assert "skipped=1" in out


def test_run_mixed_inserts_and_skips(tmp_path, monkeypatch):
    """1件は既存、もう1件は新規の混在シナリオ。"""
    report = tmp_path / "2026-04-12-briefing.md"
    report.write_text(
        """```yaml
# suggestions
suggestions:
  - title: "Already There"
    priority: high
    effort: small
    category: ux
  - title: "Brand New"
    priority: medium
    effort: medium
    category: algorithm
```""",
        encoding="utf-8",
    )

    # title で分岐して SELECT 結果を返す
    def fake_get(url, headers, params, timeout):
        if params.get("title") == "eq.Already There":
            return _FakeJsonResp(200, json_data=[{"id": "x"}])
        return _FakeJsonResp(200, json_data=[])

    monkeypatch.setattr(ingest.requests, "get", fake_get)

    post_calls = []
    monkeypatch.setattr(
        ingest.requests,
        "post",
        lambda url, headers, json, timeout: (post_calls.append(json) or _FakeResp(201)),
    )

    rc = ingest.run(report, "https://sb.example", "anon", "ikey")
    assert rc == 0
    assert len(post_calls) == 1
    assert post_calls[0]["title"] == "Brand New"


def test_run_no_yaml_returns_zero(tmp_path):
    report = tmp_path / "empty.md"
    report.write_text("no yaml here", encoding="utf-8")
    rc = ingest.run(report, "https://sb.example", "anon", "ikey")
    assert rc == 0


def test_run_missing_file_returns_one(tmp_path):
    rc = ingest.run(
        tmp_path / "does_not_exist.md", "https://sb.example", "anon", "ikey"
    )
    assert rc == 1


def test_run_any_error_returns_two(tmp_path, monkeypatch):
    report = tmp_path / "2026-04-10.md"
    report.write_text(
        """```yaml
# suggestions
suggestions:
  - title: "X"
    priority: high
    effort: small
    category: ux
```""",
        encoding="utf-8",
    )
    _mock_select_empty(monkeypatch)
    monkeypatch.setattr(
        ingest.requests, "post", lambda *a, **kw: _FakeResp(500, "boom")
    )
    rc = ingest.run(report, "https://sb.example", "anon", "ikey")
    assert rc == 2


def test_run_select_failure_counted_as_error(tmp_path, monkeypatch):
    """SELECT 自体が失敗した suggestion はエラー扱いで INSERT もされない。"""
    report = tmp_path / "2026-04-13.md"
    report.write_text(
        """```yaml
# suggestions
suggestions:
  - title: "Select Fails"
    priority: low
    effort: small
    category: other
```""",
        encoding="utf-8",
    )
    monkeypatch.setattr(
        ingest.requests,
        "get",
        lambda *a, **kw: _FakeJsonResp(500, json_data=None, text="boom"),
    )
    post_calls = []
    monkeypatch.setattr(
        ingest.requests,
        "post",
        lambda *a, **kw: (post_calls.append(kw) or _FakeResp(201)),
    )
    rc = ingest.run(report, "https://sb.example", "anon", "ikey")
    assert rc == 2
    # SELECT が失敗したので INSERT も試みない
    assert len(post_calls) == 0
