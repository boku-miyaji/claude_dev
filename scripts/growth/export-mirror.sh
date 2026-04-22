#!/usr/bin/env bash
# scripts/growth/export-mirror.sh — growth_events を Markdown ミラーにエクスポート
#
# 毎日 cron/GitHub Actions で実行される想定。
# Supabase がマスター、.company/growth/ が読み取り専用ミラー。
# 既存ミラーは毎回全削除して再生成する（手編集は次回上書きで消える前提）。
#
# Output:
#   .company/growth/README.md                           ← 全件インデックス
#   .company/growth/by-project/<project>.md             ← PJ別まとめ
#   .company/growth/YYYY/MM/YYYYMMDD-<type>-<slug>.md   ← 1レコード1ファイル
#
# Usage:
#   export-mirror.sh

set -uo pipefail

REPO_DIR="${REPO_DIR:-/workspace}"
MIRROR_DIR="$REPO_DIR/.company/growth"

source ~/.claude/hooks/supabase.env 2>/dev/null || {
  echo "Error: supabase.env not found" >&2; exit 2
}

# ------------- Fetch all records (Management API bypasses RLS) -------------
echo "[export-mirror] fetching growth_events..."
RECORDS=$(curl -s -X POST "https://api.supabase.com/v1/projects/akycymnahqypmtsfqhtr/database/query" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT id, event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, parent_id, company_id, related_commits, related_migrations, tags, status, source, created_at FROM growth_events ORDER BY event_date DESC, created_at DESC"}')

if [ -z "$RECORDS" ] || [ "$RECORDS" = "[]" ]; then
  echo "[export-mirror] no records or fetch failed"
  exit 0
fi

COUNT=$(echo "$RECORDS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null)
echo "[export-mirror] $COUNT records fetched"

# ------------- Clean mirror directory (but preserve README in repo if it's the only safe file) -------------
# We fully regenerate. Safe since source of truth is DB.
if [ -d "$MIRROR_DIR" ]; then
  # Preserve any files starting with _ (escape hatch for README pin etc.)
  find "$MIRROR_DIR" -type f ! -name '_*' -delete 2>/dev/null || true
  find "$MIRROR_DIR" -type d -empty -delete 2>/dev/null || true
fi
mkdir -p "$MIRROR_DIR/by-project"

# ------------- Export via Python (records piped via stdin to avoid argv/env limits) -------------
RECORDS_FILE=$(mktemp)
echo "$RECORDS" > "$RECORDS_FILE"
trap 'rm -f "$RECORDS_FILE"' EXIT

export MIRROR_DIR
RECORDS_FILE="$RECORDS_FILE" python3 <<'PYEOF'
import json, os, re, sys
from pathlib import Path
from collections import defaultdict

MIRROR = Path(os.environ['MIRROR_DIR'])
with open(os.environ['RECORDS_FILE'], encoding='utf-8') as f:
    records = json.load(f)

def slugify(s, maxlen=50):
    s = re.sub(r'[^\w\s-]', '', s or '').strip().lower()
    s = re.sub(r'[\s_-]+', '-', s)
    return s[:maxlen] or 'untitled'

def fmt_record_md(r):
    lines = [f"# {r.get('title', '(no title)')}", ""]
    lines.append(f"- **type**: `{r.get('event_type')}`")
    lines.append(f"- **date**: {r.get('event_date')}")
    lines.append(f"- **category**: {r.get('category')} / **severity**: {r.get('severity') or '-'}")
    lines.append(f"- **status**: {r.get('status') or 'active'}")
    lines.append(f"- **source**: {r.get('source') or '-'}")
    tags = r.get('tags') or []
    if tags:
        lines.append(f"- **tags**: {', '.join(tags)}")
    if r.get('parent_id'):
        lines.append(f"- **parent_id**: `{r['parent_id']}`")
    if r.get('related_commits'):
        lines.append(f"- **commits**: {', '.join(r['related_commits'])}")
    lines.append("")
    for section in ('what_happened', 'root_cause', 'countermeasure', 'result'):
        if r.get(section):
            lines.append(f"## {section}")
            lines.append(r[section])
            lines.append("")
    lines.append(f"<!-- id: {r.get('id')} -->")
    return "\n".join(lines) + "\n"

by_project = defaultdict(list)

for r in records:
    date_str = r.get('event_date') or '1970-01-01'
    try:
        year, month, _ = date_str.split('-')
    except ValueError:
        continue
    slug = slugify(r.get('title'))
    event_type = r.get('event_type') or 'unknown'
    date_compact = date_str.replace('-', '')
    fname = f"{date_compact}-{event_type}-{slug}.md"
    dir_path = MIRROR / year / month
    dir_path.mkdir(parents=True, exist_ok=True)
    fpath = dir_path / fname
    if fpath.exists():
        rid_short = (r.get('id') or '')[:8]
        fpath = dir_path / f"{date_compact}-{event_type}-{slug}-{rid_short}.md"
    fpath.write_text(fmt_record_md(r), encoding='utf-8')
    rel = fpath.relative_to(MIRROR)

    tags = r.get('tags') or []
    project_tag = next((t for t in tags if t in ('claude-dev','focus-you','polaris-circuit','rikyu','agent-harness')), 'unclassified')
    by_project[project_tag].append((r, rel))

by_proj_dir = MIRROR / 'by-project'
by_proj_dir.mkdir(exist_ok=True)
for project, items in by_project.items():
    lines = [f"# growth_events — `{project}`", "", f"Total: **{len(items)}**", ""]
    lines.append("| date | type | status | title |")
    lines.append("|---|---|---|---|")
    for r, rel in items:
        lines.append(f"| {r.get('event_date')} | `{r.get('event_type')}` | {r.get('status') or '-'} | [{r.get('title')}](../{rel}) |")
    (by_proj_dir / f'{project}.md').write_text("\n".join(lines) + "\n", encoding='utf-8')

lines = ["# growth_events — Markdown ミラー", ""]
lines.append("> Supabase `growth_events` テーブルの読み取り専用ミラー。")
lines.append("> 毎日 `scripts/growth/export-mirror.sh` で再生成される。**手編集しない**（次回上書きされる）。")
lines.append("")
lines.append(f"- 総レコード数: **{len(records)}**")
lines.append("")
lines.append("## PJ別")
lines.append("")
for project in sorted(by_project.keys()):
    lines.append(f"- [{project}](by-project/{project}.md) — {len(by_project[project])}件")
lines.append("")
lines.append("## 最近の20件")
lines.append("")
lines.append("| date | type | project | title |")
lines.append("|---|---|---|---|")
for r in records[:20]:
    tags = r.get('tags') or []
    proj = next((t for t in tags if t in ('claude-dev','focus-you','polaris-circuit','rikyu','agent-harness')), '-')
    lines.append(f"| {r.get('event_date')} | `{r.get('event_type')}` | {proj} | {r.get('title','')} |")
lines.append("")
lines.append("## 運用ルール")
lines.append("- マスター: Supabase `growth_events`")
lines.append("- 書き込み: `scripts/growth/record.sh` or `daily-growth-digest` バッチ")
lines.append("- 詳細: `.claude/rules/growth-events.md`")
lines.append("")

(MIRROR / 'README.md').write_text("\n".join(lines) + "\n", encoding='utf-8')
print(f"[export-mirror] wrote {len(records)} records across {len(by_project)} projects")
PYEOF

echo "[export-mirror] done"
