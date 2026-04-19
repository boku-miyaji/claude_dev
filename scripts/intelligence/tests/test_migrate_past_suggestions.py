"""migrate_past_suggestions の単体テスト（外部依存はモック）。"""
from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest

import migrate_past_suggestions as migrate


# ── has_suggestions_yaml ─────────────────────────────────────────
def test_has_suggestions_yaml_true():
    md = """```yaml
# suggestions
suggestions:
  - title: "x"
    priority: high
    effort: small
    category: ux
```"""
    assert migrate.has_suggestions_yaml(md) is True


def test_has_suggestions_yaml_false_with_other_yaml():
    md = """```yaml
# handoff
handoff:
  - to: pm
    tasks: ["x"]
```"""
    assert migrate.has_suggestions_yaml(md) is False


def test_has_suggestions_yaml_false_plain_markdown():
    assert migrate.has_suggestions_yaml("# Hello") is False


# ── extract_suggestion_section ───────────────────────────────────
def test_extract_section_basic():
    md = """# Report

## 📋 サマリー
stuff

## 💡 focus-you への示唆

### 取り入れるべき
- A
- B

### 検討に値する
- C

## handoff
"""
    section = migrate.extract_suggestion_section(md)
    assert section is not None
    assert "取り入れるべき" in section
    assert "## handoff" not in section
    assert section.startswith("## 💡 focus-you への示唆")


def test_extract_section_without_emoji():
    md = """## focus-you への示唆
- A

## next"""
    section = migrate.extract_suggestion_section(md)
    assert section is not None
    assert "- A" in section
    assert "## next" not in section


def test_extract_section_at_end_of_file():
    md = """# Report

## 💡 focus-you への示唆
- end item
"""
    section = migrate.extract_suggestion_section(md)
    assert section is not None
    assert "end item" in section


def test_extract_section_returns_none_if_missing():
    assert migrate.extract_suggestion_section("# just a header") is None


# ── extract_yaml_fence ───────────────────────────────────────────
def test_extract_yaml_fence_simple():
    out = """Sure, here you go:

```yaml
# suggestions
suggestions:
  - title: "X"
```

Hope that helps.
"""
    fence = migrate.extract_yaml_fence(out)
    assert fence is not None
    assert fence.startswith("```yaml")
    assert fence.endswith("```")
    assert "- title" in fence


def test_extract_yaml_fence_none_when_absent():
    assert migrate.extract_yaml_fence("no code here") is None


def test_extract_yaml_fence_first_match_only():
    out = """```yaml
# suggestions
suggestions:
  - title: "first"
```

```yaml
other: value
```
"""
    fence = migrate.extract_yaml_fence(out)
    assert fence is not None
    assert "first" in fence
    assert "other" not in fence


# ── insert_yaml_block ────────────────────────────────────────────
def test_insert_yaml_block_before_handoff():
    md = """# Report
body

## handoff

```yaml
handoff:
  - to: x
```
"""
    yaml_block = "```yaml\n# suggestions\nsuggestions:\n  - title: a\n```"
    result = migrate.insert_yaml_block(md, yaml_block)
    assert "# suggestions" in result
    # YAML ブロックが ## handoff より前にあること
    assert result.index("# suggestions") < result.index("## handoff")


def test_insert_yaml_block_appends_if_no_handoff():
    md = "# Report\n\njust content"
    yaml_block = "```yaml\n# suggestions\nsuggestions:\n  - title: a\n```"
    result = migrate.insert_yaml_block(md, yaml_block)
    assert result.endswith("\n")
    assert "# suggestions" in result


def test_insert_yaml_block_preserves_original_content():
    md = "# A\n\n## B\nsecond\n\n## handoff\nend"
    yaml_block = "```yaml\nsuggestions:\n  - title: x\n```"
    result = migrate.insert_yaml_block(md, yaml_block)
    assert "second" in result
    assert "end" in result


# ── process_file with mocked claude ──────────────────────────────
def _sample_report() -> str:
    return """# Intel Report

## 📋 サマリー
foo

## 💡 focus-you への示唆

### 取り入れるべき
- **Some insight** → change something
  - 対象: X
  - 工数: 小

## handoff

```yaml
handoff:
  - to: pm
    tasks: ["stuff"]
```
"""


def test_process_file_converts_via_claude(tmp_path, monkeypatch):
    report = tmp_path / "2026-04-10-briefing.md"
    report.write_text(_sample_report(), encoding="utf-8")

    fake_yaml = """```yaml
# suggestions
suggestions:
  - title: "Some insight"
    description: "change something"
    priority: medium
    effort: small
    category: architecture
    source_urls: []
```"""

    def fake_claude(section, model):
        assert "取り入れるべき" in section
        return "Here you go:\n" + fake_yaml + "\nDone."

    monkeypatch.setattr(migrate, "run_claude_convert", fake_claude)
    monkeypatch.setattr(migrate, "ingest_run", lambda *a, **kw: 0)

    ok, reason = migrate.process_file(
        report,
        supabase_url="https://sb.example",
        anon_key="anon",
        ingest_key="ikey",
        dry_run=False,
        skip_ingest=False,
        model="sonnet",
    )
    assert ok is True
    assert reason == "ok"

    new_md = report.read_text(encoding="utf-8")
    assert "# suggestions" in new_md
    # ハンドオフ前に挿入されている
    assert new_md.index("# suggestions") < new_md.index("## handoff")


def test_process_file_skips_if_already_has_yaml(tmp_path, monkeypatch):
    report = tmp_path / "2026-04-10.md"
    report.write_text(
        """# R

## 💡 focus-you への示唆
- a

```yaml
# suggestions
suggestions:
  - title: "already there"
    priority: high
    effort: small
    category: ux
```
""",
        encoding="utf-8",
    )

    called = []
    monkeypatch.setattr(
        migrate, "run_claude_convert", lambda *a, **kw: called.append(1) or "x"
    )

    ok, reason = migrate.process_file(
        report,
        supabase_url="sb",
        anon_key="a",
        ingest_key="i",
        dry_run=False,
        skip_ingest=False,
        model="sonnet",
    )
    assert ok is True
    assert "already" in reason
    assert called == []  # claude 未呼び出し


def test_process_file_skips_if_no_section(tmp_path, monkeypatch):
    report = tmp_path / "empty.md"
    report.write_text("# Just a report with no suggestion section", encoding="utf-8")

    called = []
    monkeypatch.setattr(
        migrate, "run_claude_convert", lambda *a, **kw: called.append(1) or "x"
    )

    ok, reason = migrate.process_file(
        report,
        supabase_url="sb",
        anon_key="a",
        ingest_key="i",
        dry_run=False,
        skip_ingest=False,
        model="sonnet",
    )
    assert ok is True
    assert "no" in reason.lower()
    assert called == []


def test_process_file_claude_failure_returns_false(tmp_path, monkeypatch):
    report = tmp_path / "2026-04-10.md"
    report.write_text(_sample_report(), encoding="utf-8")
    monkeypatch.setattr(migrate, "run_claude_convert", lambda *a, **kw: None)

    ok, reason = migrate.process_file(
        report,
        supabase_url="sb",
        anon_key="a",
        ingest_key="i",
        dry_run=False,
        skip_ingest=False,
        model="sonnet",
    )
    assert ok is False
    assert "claude" in reason.lower()


def test_process_file_dry_run_does_not_write(tmp_path, monkeypatch):
    report = tmp_path / "2026-04-10.md"
    original = _sample_report()
    report.write_text(original, encoding="utf-8")

    fake_yaml = "```yaml\n# suggestions\nsuggestions:\n  - title: x\n    priority: high\n    effort: small\n    category: ux\n```"
    monkeypatch.setattr(migrate, "run_claude_convert", lambda *a, **kw: fake_yaml)

    ingest_calls = []
    monkeypatch.setattr(
        migrate, "ingest_run", lambda *a, **kw: ingest_calls.append(1) or 0
    )

    ok, reason = migrate.process_file(
        report,
        supabase_url="sb",
        anon_key="a",
        ingest_key="i",
        dry_run=True,
        skip_ingest=False,
        model="sonnet",
    )
    assert ok is True
    assert "dry-run" in reason
    # ファイルは書き変わらない
    assert report.read_text(encoding="utf-8") == original
    # ingest も呼ばれない
    assert ingest_calls == []


def test_process_file_skip_ingest_flag(tmp_path, monkeypatch):
    report = tmp_path / "2026-04-10.md"
    report.write_text(_sample_report(), encoding="utf-8")

    fake_yaml = "```yaml\n# suggestions\nsuggestions:\n  - title: x\n    priority: high\n    effort: small\n    category: ux\n```"
    monkeypatch.setattr(migrate, "run_claude_convert", lambda *a, **kw: fake_yaml)

    ingest_calls = []
    monkeypatch.setattr(
        migrate, "ingest_run", lambda *a, **kw: ingest_calls.append(1) or 0
    )

    ok, reason = migrate.process_file(
        report,
        supabase_url="sb",
        anon_key="a",
        ingest_key="i",
        dry_run=False,
        skip_ingest=True,
        model="sonnet",
    )
    assert ok is True
    assert "ingest" in reason.lower()
    # YAML は書き込まれたが INSERT はスキップ
    assert "# suggestions" in report.read_text(encoding="utf-8")
    assert ingest_calls == []
