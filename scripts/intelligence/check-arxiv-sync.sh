#!/usr/bin/env bash
# sources.yaml の arxiv キーワード/カテゴリが news-collect Edge Function の
# ARXIV_KEYWORDS / ARXIV_CATEGORIES と一致しているか検証する。
#
# 差分があれば exit 1。CI で実行して死に設定を早期検出する。
#
# 再発防止: 2026-04-19 に arxiv:2604.14228 (Dive into Claude Code) を取り
# こぼした事象の根本原因は「sources.yaml のキーワードが本番実装に反映
# されていなかった」こと。両者を同期強制する。

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
YAML_FILE="${REPO_ROOT}/.company/departments/intelligence/sources.yaml"
TS_FILE="${REPO_ROOT}/company-dashboard/supabase/functions/news-collect/index.ts"

if [ ! -f "$YAML_FILE" ]; then
  echo "ERROR: $YAML_FILE not found"
  exit 2
fi
if [ ! -f "$TS_FILE" ]; then
  echo "ERROR: $TS_FILE not found"
  exit 2
fi

# ---- yaml から academic_papers.arxiv の keywords/categories を抽出 ----
# PyYAML を使って flow / block の両形式に対応する。
# pip install されてなければ自動インストールする（GitHub Actions runner 用）。
python3 -c "import yaml" 2>/dev/null || pip install --quiet pyyaml >/dev/null 2>&1

YAML_KEYWORDS=$(python3 - <<PY
import sys, yaml
with open("$YAML_FILE") as f:
    data = yaml.safe_load(f)
ap = (data or {}).get("academic_papers") or {}
arxiv = ap.get("arxiv") or {}
# keywords は { keywords: [{term: ...}, ...] } の形 or トップレベル keywords どちらでも拾う
kw_list = arxiv.get("keywords") or ap.get("keywords") or []
terms = []
for kw in kw_list:
    if isinstance(kw, dict) and "term" in kw:
        terms.append(kw["term"])
    elif isinstance(kw, str):
        terms.append(kw)
print("\n".join(terms))
PY
)

YAML_CATEGORIES=$(python3 - <<PY
import sys, yaml
with open("$YAML_FILE") as f:
    data = yaml.safe_load(f)
ap = (data or {}).get("academic_papers") or {}
arxiv = ap.get("arxiv") or {}
cats = arxiv.get("categories") or ap.get("categories")
if not cats:
    sys.exit("categories list not found under academic_papers.arxiv")
print("\n".join(sorted(cats)))
PY
)

# ---- index.ts から ARXIV_KEYWORDS / ARXIV_CATEGORIES を抽出 ----
TS_KEYWORDS=$(python3 - <<PY
import re, sys
with open("$TS_FILE") as f:
    text = f.read()
m = re.search(r"const\s+ARXIV_KEYWORDS\s*=\s*\[(.*?)\];", text, re.S)
if not m:
    sys.exit("ARXIV_KEYWORDS not found")
terms = re.findall(r'"([^"]+)"', m.group(1))
print("\n".join(terms))
PY
)

TS_CATEGORIES=$(python3 - <<PY
import re, sys
with open("$TS_FILE") as f:
    text = f.read()
m = re.search(r"const\s+ARXIV_CATEGORIES\s*=\s*\[(.*?)\];", text, re.S)
if not m:
    sys.exit("ARXIV_CATEGORIES not found")
cats = re.findall(r'"([^"]+)"', m.group(1))
print("\n".join(sorted(cats)))
PY
)

exit_code=0

# ---- カテゴリ比較 ----
if [ "$YAML_CATEGORIES" != "$TS_CATEGORIES" ]; then
  echo "::error::arxiv categories diverged between sources.yaml and news-collect/index.ts"
  echo "--- yaml (expected) ---"
  echo "$YAML_CATEGORIES"
  echo "--- index.ts (actual) ---"
  echo "$TS_CATEGORIES"
  exit_code=1
fi

# ---- キーワード比較（yaml ⊆ index.ts を要求: index.ts 側に追加があるのは OK）----
missing=""
while IFS= read -r kw; do
  [ -z "$kw" ] && continue
  if ! grep -Fxq "$kw" <<< "$TS_KEYWORDS"; then
    missing="${missing}${kw}\n"
  fi
done <<< "$YAML_KEYWORDS"

if [ -n "$missing" ]; then
  echo "::error::arxiv keywords in sources.yaml are missing from news-collect/index.ts ARXIV_KEYWORDS"
  echo "--- missing from index.ts ---"
  printf "%b" "$missing"
  exit_code=1
fi

if [ "$exit_code" -eq 0 ]; then
  echo "✅ arxiv sync OK: sources.yaml ⊆ news-collect/index.ts"
  echo "   yaml keywords: $(echo "$YAML_KEYWORDS" | wc -l | tr -d ' ')"
  echo "   ts keywords:   $(echo "$TS_KEYWORDS" | wc -l | tr -d ' ')"
  echo "   categories:    $(echo "$YAML_CATEGORIES" | tr '\n' ' ')"
fi

exit "$exit_code"
