#!/usr/bin/env python3
"""
情報収集部レポートから構造化示唆を抽出し、intelligence_suggestions テーブルに INSERT する。

使い方:
    python scripts/intelligence/ingest_suggestions.py <report.md>

処理:
    1. レポートファイルを読み込み
    2. ```yaml ... ``` コードフェンス内で、先頭に `# suggestions` コメントを持つか、
       top-level キー `suggestions:` を持つブロックを抽出
    3. yaml.safe_load でパース
    4. 各項目について、まず (title, source_report_path) で既存確認（SELECT）
       存在すればスキップ（冪等）
    5. 存在しなければ intelligence_suggestions テーブルへ INSERT
       - source_report_path: レポートの .company/... 相対パス
       - source_report_date: ファイル名から YYYY-MM-DD を抽出
       - status: 'new'

環境変数:
    SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_INGEST_KEY

終了コード:
    0: 成功（全件 INSERT または skip）
    1: 引数 / パースエラー
    2: ネットワーク / DB エラー
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from datetime import date as _date
from pathlib import Path
from typing import Any

import requests
import yaml


# ── 設定 ─────────────────────────────────────────────────────────
ALLOWED_PRIORITIES = {"high", "medium", "low"}
ALLOWED_EFFORTS = {"small", "medium", "large"}
ALLOWED_CATEGORIES = {
    "algorithm",
    "architecture",
    "ux",
    "cost",
    "competition",
    "design",
    "other",
}
ALLOWED_TARGETS = {"focus-you", "hd-ops", "both"}

# ```yaml ... ``` コードフェンスを抽出する正規表現
# - 開始: ```yaml（または ``` yaml）
# - 終了: ```
# - 中身はキャプチャ
YAML_FENCE_RE = re.compile(
    r"```\s*ya?ml\s*\n(.*?)\n```",
    re.DOTALL | re.IGNORECASE,
)

# ファイル名から日付を抽出（YYYY-MM-DD）
DATE_IN_FILENAME_RE = re.compile(r"(\d{4}-\d{2}-\d{2})")


# ── パーサー ─────────────────────────────────────────────────────
def extract_suggestions_yaml(markdown: str) -> list[dict[str, Any]]:
    """Markdown 本文から suggestions YAML ブロックを抽出して dict リストを返す。

    抽出ルール:
        - ```yaml ... ``` フェンスを順に走査
        - フェンス内の先頭行が `# suggestions` コメント、
          または top-level キーが `suggestions:` のものを採用
        - 同一ファイル内に複数マッチした場合、全て結合する

    パースに失敗したブロックは無視する（末尾の別 YAML handoff などとの共存を許容）。

    Returns:
        [{title, description, priority, effort, category, source_urls}, ...]
    """
    collected: list[dict[str, Any]] = []

    for match in YAML_FENCE_RE.finditer(markdown):
        block = match.group(1)
        first_line = block.lstrip().splitlines()[0] if block.strip() else ""

        # 明示的な "# suggestions" マーカー優先
        has_marker = first_line.strip().lower().startswith("# suggestions")

        # マーカーがない場合は top-level key を見る
        try:
            data = yaml.safe_load(block)
        except yaml.YAMLError:
            continue

        if not isinstance(data, dict):
            continue

        items = data.get("suggestions")
        if not isinstance(items, list):
            continue

        # suggestions キーを持っていれば採用（has_marker は補助情報）
        _ = has_marker  # 現状はフラグのみ。将来のデバッグ/優先制御用
        for item in items:
            if not isinstance(item, dict):
                continue
            normalized = _normalize_suggestion(item)
            if normalized is not None:
                collected.append(normalized)

    return collected


def _normalize_suggestion(raw: dict[str, Any]) -> dict[str, Any] | None:
    """単一 suggestion dict を DB INSERT 用に正規化。不正なら None。"""
    title = raw.get("title")
    if not isinstance(title, str) or not title.strip():
        return None

    description = raw.get("description")
    if description is not None and not isinstance(description, str):
        description = str(description)

    priority = raw.get("priority")
    if priority is not None:
        priority = str(priority).lower().strip()
        if priority not in ALLOWED_PRIORITIES:
            priority = None

    effort = raw.get("effort")
    if effort is not None:
        effort = str(effort).lower().strip()
        if effort not in ALLOWED_EFFORTS:
            effort = None

    category = raw.get("category")
    if category is not None:
        category = str(category).lower().strip()
        # 未知のカテゴリは 'other' に寄せる（DB 側の CHECK 制約なしだが整合用）
        if category not in ALLOWED_CATEGORIES:
            category = "other"

    target = raw.get("target")
    if target is not None:
        target = str(target).lower().strip()
        if target not in ALLOWED_TARGETS:
            target = "focus-you"
    else:
        target = "focus-you"  # デフォルト: 既存レポートとの後方互換

    source_urls_raw = raw.get("source_urls") or []
    if isinstance(source_urls_raw, str):
        source_urls = [source_urls_raw]
    elif isinstance(source_urls_raw, list):
        source_urls = [str(u) for u in source_urls_raw if u]
    else:
        source_urls = []

    return {
        "title": title.strip(),
        "description": (description or "").strip() or None,
        "priority": priority,
        "effort": effort,
        "category": category,
        "target": target,
        "source_urls": source_urls,
    }


# ── 補助 ─────────────────────────────────────────────────────────
def infer_source_report_path(file_path: Path) -> str:
    """絶対パスから .company/... 相対表示を作る。"""
    try:
        # "/workspace/.company/..." → ".company/..."
        parts = file_path.resolve().parts
        if ".company" in parts:
            idx = parts.index(".company")
            return str(Path(*parts[idx:]))
    except Exception:
        pass
    return file_path.name


def infer_source_report_date(file_path: Path) -> str | None:
    """ファイル名から YYYY-MM-DD を抽出。見つからなければ None。"""
    m = DATE_IN_FILENAME_RE.search(file_path.name)
    if m:
        candidate = m.group(1)
        # バリデーション
        try:
            _date.fromisoformat(candidate)
            return candidate
        except ValueError:
            return None
    return None


# ── DB 通信 ──────────────────────────────────────────────────────
def check_existing(
    supabase_url: str,
    anon_key: str,
    ingest_key: str,
    title: str,
    source_report_path: str,
    timeout: float = 10.0,
) -> bool | None:
    """(title, source_report_path) の組み合わせが既に存在するか確認。

    Returns:
        True: 既存あり（スキップ対象）
        False: 既存なし（INSERT して良い）
        None: 通信エラー（判定不能 → 呼び出し側でエラー扱い）
    """
    # PostgREST フィルタ: title と source_report_path で完全一致
    headers = {
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}",
        "x-ingest-key": ingest_key,
    }
    # URL エンコード（PostgREST は `eq.<value>` の形式）
    params = {
        "title": f"eq.{title}",
        "source_report_path": f"eq.{source_report_path}",
        "select": "id",
        "limit": "1",
    }
    try:
        resp = requests.get(
            f"{supabase_url}/rest/v1/intelligence_suggestions",
            headers=headers,
            params=params,
            timeout=timeout,
        )
    except requests.RequestException as exc:
        print(f"  [error] SELECT 失敗 {title[:60]}: {exc}", file=sys.stderr)
        return None

    if resp.status_code == 200:
        try:
            rows = resp.json()
        except ValueError:
            rows = []
        return len(rows) > 0

    body = (resp.text or "")[:200]
    print(
        f"  [error] SELECT HTTP {resp.status_code} {body}",
        file=sys.stderr,
    )
    return None


def post_suggestion(
    supabase_url: str,
    anon_key: str,
    ingest_key: str,
    payload: dict[str, Any],
    timeout: float = 10.0,
) -> tuple[str, int]:
    """単一 suggestion を INSERT。戻り値は (result, status_code)。

    result:
        'inserted' | 'duplicate' | 'error'

    注意: 冪等性は呼び出し側で check_existing() を先に呼んで担保する。
    本関数は安全網として Prefer: resolution=ignore-duplicates も付けるが、
    現時点で DB 側に UNIQUE 制約は無いため、SELECT による事前チェックが主防衛ライン。
    """
    headers = {
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal,resolution=ignore-duplicates",
        "x-ingest-key": ingest_key,
    }
    try:
        resp = requests.post(
            f"{supabase_url}/rest/v1/intelligence_suggestions",
            headers=headers,
            json=payload,
            timeout=timeout,
        )
    except requests.RequestException as exc:
        print(f"  [error] {payload['title'][:60]}: {exc}", file=sys.stderr)
        return "error", 0

    if resp.status_code in (200, 201):
        return "inserted", resp.status_code

    if resp.status_code == 409 or (resp.text and "23505" in resp.text):
        return "duplicate", resp.status_code

    # その他エラー
    body = (resp.text or "")[:200]
    print(
        f"  [error] {payload['title'][:60]}: HTTP {resp.status_code} {body}",
        file=sys.stderr,
    )
    return "error", resp.status_code


# ── メイン ───────────────────────────────────────────────────────
def build_insert_payload(
    suggestion: dict[str, Any],
    source_report_path: str,
    source_report_date: str | None,
) -> dict[str, Any]:
    """DB 用 JSON 構造を組み立てる。"""
    payload: dict[str, Any] = {
        "title": suggestion["title"],
        "description": suggestion["description"],
        "priority": suggestion["priority"],
        "effort": suggestion["effort"],
        "category": suggestion["category"],
        "target": suggestion.get("target", "focus-you"),
        "source_urls": suggestion["source_urls"],
        "source_report_path": source_report_path,
        "status": "new",
    }
    if source_report_date:
        payload["source_report_date"] = source_report_date
    return payload


def run(
    file_path: Path,
    supabase_url: str,
    anon_key: str,
    ingest_key: str,
) -> int:
    if not file_path.exists():
        print(f"ERROR: ファイルが存在しません: {file_path}", file=sys.stderr)
        return 1

    markdown = file_path.read_text(encoding="utf-8")
    suggestions = extract_suggestions_yaml(markdown)

    if not suggestions:
        print(
            f"WARN: {file_path.name} に suggestions YAML ブロックが見つかりません",
            file=sys.stderr,
        )
        return 0

    source_report_path = infer_source_report_path(file_path)
    source_report_date = infer_source_report_date(file_path)

    print(f"[ingest] {source_report_path} ({source_report_date or '日付不明'})")
    print(f"[ingest] 抽出件数: {len(suggestions)}")

    inserted = 0
    skipped = 0
    errors = 0

    for sug in suggestions:
        payload = build_insert_payload(sug, source_report_path, source_report_date)

        # 冪等性: (title, source_report_path) が既にあればスキップ
        exists = check_existing(
            supabase_url,
            anon_key,
            ingest_key,
            sug["title"],
            source_report_path,
        )
        if exists is None:
            # SELECT 自体が失敗した場合はエラー扱い（誤って重複 INSERT しない）
            errors += 1
            continue
        if exists:
            print(f"  [skip] 既存: {sug['title'][:60]}")
            skipped += 1
            continue

        result, _ = post_suggestion(supabase_url, anon_key, ingest_key, payload)
        if result == "inserted":
            print(f"  [insert] {sug['title'][:60]}")
            inserted += 1
        elif result == "duplicate":
            # SELECT 後の競合レース。スキップ扱い
            skipped += 1
        else:
            errors += 1

    print(
        f"[ingest] 結果: inserted={inserted} skipped={skipped} errors={errors}"
    )

    return 2 if errors > 0 else 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="情報収集レポートの suggestions YAML を DB に INSERT"
    )
    parser.add_argument("report_path", type=Path, help="レポート .md ファイルパス")
    args = parser.parse_args(argv)

    supabase_url = os.environ.get("SUPABASE_URL")
    anon_key = os.environ.get("SUPABASE_ANON_KEY")
    ingest_key = os.environ.get("SUPABASE_INGEST_KEY")

    if not supabase_url or not anon_key or not ingest_key:
        print(
            "ERROR: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_INGEST_KEY を設定してください",
            file=sys.stderr,
        )
        return 1

    return run(args.report_path, supabase_url, anon_key, ingest_key)


if __name__ == "__main__":
    sys.exit(main())
