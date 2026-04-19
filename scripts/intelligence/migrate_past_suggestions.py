#!/usr/bin/env python3
"""
過去の情報収集レポートから `## 💡 focus-you への示唆` セクションを抽出し、
claude CLI で YAML 構造化したうえでレポート末尾に追記、intelligence_suggestions
テーブルに INSERT する移行スクリプト。

使い方:
    python scripts/intelligence/migrate_past_suggestions.py [--dry-run] [--skip-ingest] [--glob 'YYYY-*.md']

処理:
    1. `.company/departments/intelligence/reports/*.md` を走査（または --glob 指定）
    2. 既に `# suggestions` YAML ブロックがあればスキップ（冪等）
    3. `## 💡 focus-you への示唆` セクションが無ければスキップ
    4. セクションを claude --print にパイプして YAML に変換
    5. 生成 YAML を ```yaml フェンスでラップしてレポート末尾に追加
       （既存の `## handoff` ブロックがあればその前に挿入）
    6. ingest_suggestions.run() を呼んで DB に INSERT

ログ:
    - stdout: 処理結果サマリ
    - stderr: 失敗ファイル一覧（手動対応リスト）

社長ルール:
    LLM 分析は API ではなく Claude Code CLI を使う。API 課金を避ける。
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

# 同ディレクトリの ingest_suggestions を使う（Path 追加で import 可能に）
sys.path.insert(0, str(Path(__file__).resolve().parent))
from ingest_suggestions import (  # noqa: E402
    extract_suggestions_yaml,
    run as ingest_run,
)


# ── 設定 ─────────────────────────────────────────────────────────
REPORTS_DIR = Path(".company/departments/intelligence/reports")
SUGGEST_SECTION_HEADERS = (
    "## 💡 focus-you への示唆",
    "## focus-you への示唆",
)
HANDOFF_MARKERS = ("## handoff", "## Handoff", "## ハンドオフ")

CLAUDE_MODEL_DEFAULT = "sonnet"

# Claude CLI に渡すシステムプロンプト
YAML_CONVERSION_SYSTEM_PROMPT = """\
あなたは情報収集レポートの構造化アシスタントです。
入力された Markdown セクション（focus-you への示唆）を、intelligence_suggestions の YAML 形式に変換してください。

出力要件:
1. 必ず ```yaml ... ``` で囲む
2. 先頭行に `# suggestions` コメントを置く
3. 次に `suggestions:` キーで始まるリストを置く
4. 各項目は以下のフィールドを持つ:
   - title: 1行で要点を表す（日本語または英語、元の見出しを参考に）
   - description: 100字以内の補足説明
   - priority: high | medium | low（元記述の優先度に従う。「取り入れるべき」は high〜medium、「検討に値する」は medium〜low、「現状正しい」は low）
   - effort: small | medium | large（元記述の工数記載を参考に。記載なければ medium）
   - category: algorithm | architecture | ux | cost | competition | design | other
   - source_urls: 関連 URL の配列（元文中に明示 URL が無ければ空配列 [] ）

5. YAML 以外の説明文は一切出力しない（コードブロックのみ）
6. 元セクションに項目がなければ `suggestions: []` を出力

出力例:
```yaml
# suggestions
suggestions:
  - title: "..."
    description: "..."
    priority: medium
    effort: medium
    category: architecture
    source_urls: []
```
"""


# ── 補助 ─────────────────────────────────────────────────────────
def has_suggestions_yaml(markdown: str) -> bool:
    """既に # suggestions YAML ブロックが含まれているか判定。"""
    return len(extract_suggestions_yaml(markdown)) > 0


def extract_suggestion_section(markdown: str) -> str | None:
    """Markdown から `## 💡 focus-you への示唆` セクションを切り出す。

    対象セクションの見出し行から、次の `## ` 見出しが現れる直前までを返す。
    見つからなければ None。
    """
    lines = markdown.splitlines()
    start_idx: int | None = None
    for i, line in enumerate(lines):
        stripped = line.strip()
        for header in SUGGEST_SECTION_HEADERS:
            if stripped == header or stripped.startswith(header):
                start_idx = i
                break
        if start_idx is not None:
            break

    if start_idx is None:
        return None

    end_idx = len(lines)
    for j in range(start_idx + 1, len(lines)):
        line = lines[j].lstrip()
        if line.startswith("## ") and not line.startswith("### "):
            end_idx = j
            break

    section = "\n".join(lines[start_idx:end_idx]).strip()
    return section or None


def run_claude_convert(section_markdown: str, model: str = CLAUDE_MODEL_DEFAULT) -> str | None:
    """claude --print を呼んで YAML を得る。失敗時は None。

    入力: section_markdown（stdin 経由）
    出力: stdout（```yaml ... ``` フェンス込みが期待値）
    """
    try:
        proc = subprocess.run(
            [
                "claude",
                "--print",
                "--model",
                model,
                "--system-prompt",
                YAML_CONVERSION_SYSTEM_PROMPT,
            ],
            input=section_markdown,
            capture_output=True,
            text=True,
            timeout=120,
        )
    except FileNotFoundError:
        print("ERROR: claude CLI が見つかりません。", file=sys.stderr)
        return None
    except subprocess.TimeoutExpired:
        print("ERROR: claude CLI がタイムアウトしました。", file=sys.stderr)
        return None

    if proc.returncode != 0:
        print(
            f"ERROR: claude CLI 失敗 (rc={proc.returncode}): {proc.stderr[:300]}",
            file=sys.stderr,
        )
        return None

    return proc.stdout


def extract_yaml_fence(claude_output: str) -> str | None:
    """claude の出力から最初の ```yaml ... ``` フェンスを抽出。"""
    import re

    pat = re.compile(r"```\s*ya?ml\s*\n.*?\n```", re.DOTALL | re.IGNORECASE)
    m = pat.search(claude_output)
    if m:
        return m.group(0)
    return None


def insert_yaml_block(markdown: str, yaml_block: str) -> str:
    """YAML ブロックを Markdown に挿入する。

    - 既存の `## handoff` 系セクションがあればその直前に挿入
    - 無ければ末尾に追加
    """
    lines = markdown.splitlines()
    handoff_idx: int | None = None
    for i, line in enumerate(lines):
        stripped = line.strip()
        for marker in HANDOFF_MARKERS:
            if stripped == marker or stripped.startswith(marker):
                handoff_idx = i
                break
        if handoff_idx is not None:
            break

    injection = ["", "<!-- intelligence_suggestions (auto-generated) -->", yaml_block, ""]

    if handoff_idx is not None:
        # handoff の前に挿入
        before = lines[:handoff_idx]
        after = lines[handoff_idx:]
        merged = before + injection + after
    else:
        merged = lines + injection

    result = "\n".join(merged)
    if not result.endswith("\n"):
        result += "\n"
    return result


# ── メイン ───────────────────────────────────────────────────────
def process_file(
    file_path: Path,
    supabase_url: str | None,
    anon_key: str | None,
    ingest_key: str | None,
    *,
    dry_run: bool,
    skip_ingest: bool,
    model: str,
) -> tuple[bool, str]:
    """1ファイルを処理。戻り値は (success, reason)。"""
    markdown = file_path.read_text(encoding="utf-8")

    if has_suggestions_yaml(markdown):
        return True, "already has suggestions YAML"

    section = extract_suggestion_section(markdown)
    if not section:
        return True, "no '## focus-you への示唆' section"

    print(f"[migrate] {file_path.name}: converting via claude CLI...")
    output = run_claude_convert(section, model=model)
    if output is None:
        return False, "claude CLI failed"

    yaml_block = extract_yaml_fence(output)
    if not yaml_block:
        print(
            f"  [warn] {file_path.name}: claude 出力から YAML フェンスを抽出できませんでした",
            file=sys.stderr,
        )
        return False, "no YAML fence in claude output"

    new_markdown = insert_yaml_block(markdown, yaml_block)

    if dry_run:
        print(f"  [dry-run] {file_path.name}: would write {len(new_markdown)} chars")
        return True, "dry-run: skipped write"

    file_path.write_text(new_markdown, encoding="utf-8")
    print(f"  [write] {file_path.name}: YAML ブロック追記完了")

    if skip_ingest:
        return True, "ingest skipped by flag"

    if not (supabase_url and anon_key and ingest_key):
        return False, "supabase env vars missing, ingest skipped"

    ingest_rc = ingest_run(file_path, supabase_url, anon_key, ingest_key)
    if ingest_rc != 0:
        return False, f"ingest returned rc={ingest_rc}"

    return True, "ok"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="過去レポートからの示唆移行")
    parser.add_argument(
        "--glob",
        default="*.md",
        help="reports/ 内のグロブパターン（デフォルト: *.md）",
    )
    parser.add_argument(
        "--reports-dir",
        type=Path,
        default=REPORTS_DIR,
        help="レポートディレクトリ（デフォルト: .company/departments/intelligence/reports）",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="ファイル書き込み・DB INSERT を行わない",
    )
    parser.add_argument(
        "--skip-ingest",
        action="store_true",
        help="YAML 追記は行うが DB INSERT はスキップ",
    )
    parser.add_argument(
        "--model",
        default=CLAUDE_MODEL_DEFAULT,
        help=f"claude --model 引数（デフォルト: {CLAUDE_MODEL_DEFAULT}）",
    )
    args = parser.parse_args(argv)

    supabase_url = os.environ.get("SUPABASE_URL")
    anon_key = os.environ.get("SUPABASE_ANON_KEY")
    ingest_key = os.environ.get("SUPABASE_INGEST_KEY")

    if not args.reports_dir.exists():
        print(f"ERROR: ディレクトリが存在しません: {args.reports_dir}", file=sys.stderr)
        return 1

    files = sorted(args.reports_dir.glob(args.glob))
    if not files:
        print(f"WARN: マッチするファイルがありません: {args.reports_dir}/{args.glob}")
        return 0

    print(f"[migrate] 対象ファイル {len(files)} 件")

    success = 0
    skipped = 0
    failed: list[tuple[str, str]] = []

    for path in files:
        try:
            ok, reason = process_file(
                path,
                supabase_url,
                anon_key,
                ingest_key,
                dry_run=args.dry_run,
                skip_ingest=args.skip_ingest,
                model=args.model,
            )
        except Exception as exc:  # noqa: BLE001
            ok, reason = False, f"exception: {exc}"

        if ok:
            if reason.startswith("ok") or reason.startswith("dry-run"):
                success += 1
            else:
                skipped += 1
            print(f"  [ok] {path.name}: {reason}")
        else:
            failed.append((path.name, reason))
            print(f"  [fail] {path.name}: {reason}", file=sys.stderr)

    print(
        f"[migrate] 完了: success={success} skipped={skipped} failed={len(failed)}"
    )

    if failed:
        print("\n手動対応が必要なファイル:", file=sys.stderr)
        for name, reason in failed:
            print(f"  - {name}: {reason}", file=sys.stderr)
        return 2

    return 0


if __name__ == "__main__":
    sys.exit(main())
