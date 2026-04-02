#!/bin/bash
# repo-map-scan.sh — ワークスペース内のリポジトリを自動スキャンし .company/repo-map.md を生成・更新
# ローカル専用（.gitignore 対象）。サーバーごとに異なる構成を自動検出する。
set -uo pipefail

WORKSPACE="${1:-/workspace}"
REPO_MAP="$WORKSPACE/.company/repo-map.md"
REGISTRY="$WORKSPACE/.company/registry.md"
QUIET="${2:-}"

log() { [ "$QUIET" != "--quiet" ] && echo "$@"; }

# ────────────────────────────────────────
# 1. リポジトリスキャン
# ────────────────────────────────────────

scan_repos() {
  for dir in "$WORKSPACE"/*/; do
    [ ! -d "$dir" ] && continue
    local name=$(basename "$dir")

    # .company* ディレクトリはスキップ
    [[ "$name" == .company* ]] && continue
    [[ "$name" == .claude* ]] && continue
    [[ "$name" == .cache* ]] && continue
    [[ "$name" == node_modules ]] && continue

    local git_type="claude_dev配下"
    local remote="-"

    if [ -d "$dir/.git" ]; then
      git_type="独自"
      remote=$(git -C "$dir" remote get-url origin 2>/dev/null || echo "no remote")
    fi

    # PJ会社との紐づきを registry.md から検索
    local linked_company="-"
    if [ -f "$REGISTRY" ]; then
      linked_company=$(grep -P "\|\s*${name}/?\s*\|" "$REGISTRY" 2>/dev/null | awk -F'|' '{gsub(/^[ \t]+|[ \t]+$/,"",$2); print $2}' | head -1)
      [ -z "$linked_company" ] && linked_company="-"
    fi

    echo "${name}|${git_type}|${remote}|${linked_company}"
  done
}

# ────────────────────────────────────────
# 2. repo-map.md 生成
# ────────────────────────────────────────

generate_repo_map() {
  local scan_data="$1"
  local hostname=$(hostname 2>/dev/null || echo "unknown")
  local date=$(date +%Y-%m-%d)

  cat <<HEADER
# リポジトリマップ（ローカル専用）

- **サーバー**: ${hostname}
- **ワークスペース**: ${WORKSPACE}
- **最終スキャン**: ${date}

> このファイルはサーバーごとにローカル管理される（.gitignore対象）。
> \`scripts/company/repo-map-scan.sh\` で自動生成・更新される。

## マッピング

| ディレクトリ | git | リモート | 紐づきPJ会社 |
|-------------|-----|---------|-------------|
HEADER

  while IFS='|' read -r name git_type remote linked; do
    [ -z "$name" ] && continue
    # リモートURLを短縮表示
    local remote_short="$remote"
    remote_short=$(echo "$remote_short" | sed 's|git@github.com:||' | sed 's|https://github.com/||' | sed 's|\.git$||')
    echo "| \`${name}/\` | ${git_type} | ${remote_short} | ${linked} |"
  done <<< "$scan_data"

  cat <<FOOTER

## 参照パターン

| パターン | 操作 |
|---------|------|
| claude_dev配下 | 読み書き（コミット先はclaude_dev） |
| 独自リポジトリ | 読み書き（コミット先はそのリポジトリ） |
| 他者OSSリポジトリ | 参照のみ（PR提出は可） |
FOOTER
}

# ────────────────────────────────────────
# 3. 差分検出 & 更新
# ────────────────────────────────────────

SCAN_DATA=$(scan_repos)

if [ -f "$REPO_MAP" ]; then
  # 既存のマッピングからディレクトリ一覧を抽出
  existing=$(grep -oP '(?<=\| `)[^/]+(?=/`)' "$REPO_MAP" 2>/dev/null | sort)
  scanned=$(echo "$SCAN_DATA" | cut -d'|' -f1 | sort)

  added=$(comm -13 <(echo "$existing") <(echo "$scanned"))
  removed=$(comm -23 <(echo "$existing") <(echo "$scanned"))

  if [ -z "$added" ] && [ -z "$removed" ]; then
    # 日付だけ更新
    sed -i "s/\*\*最終スキャン\*\*: .*/\*\*最終スキャン\*\*: $(date +%Y-%m-%d)/" "$REPO_MAP"
    log "✅ repo-map.md: 変更なし（スキャン日時を更新）"
    exit 0
  fi

  # 変更あり → 再生成
  generate_repo_map "$SCAN_DATA" > "$REPO_MAP"
  log "🔄 repo-map.md を更新しました"
  [ -n "$added" ] && log "  ➕ 追加: $(echo "$added" | tr '\n' ', ' | sed 's/,$//')"
  [ -n "$removed" ] && log "  ➖ 削除: $(echo "$removed" | tr '\n' ', ' | sed 's/,$//')"
else
  # 新規生成
  generate_repo_map "$SCAN_DATA" > "$REPO_MAP"
  log "🆕 repo-map.md を新規生成しました（$(echo "$SCAN_DATA" | wc -l) リポジトリ検出）"
fi
