#!/usr/bin/env bash
# scripts/growth/check-workflow-failures.sh
#
# 過去 N 時間 (default 26h) で failure / startup_failure になった GitHub Actions
# workflow を growth_events に failure として記録する。
#
# 目的:
#   - silent batch failure が 6 日連続で気付かれなかった事案 (2026-04-21〜26)の再発防止
#   - growth_events 経由でブリーフィング・/company に浮上させる
#
# 重複防止:
#   - record.sh が title + 7日以内の重複を弾くため、毎日走らせても 1件1回
#   - 同じ workflow が連続失敗しているケースは 7日後に再記録され、未解決サインになる
#
# Usage:
#   ./check-workflow-failures.sh [--hours=N] [--dry-run]
#
# 環境変数:
#   GH_TOKEN: GitHub PAT (read access to actions)。未設定なら ~/.claude/hooks/github.env から読む。

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

HOURS=26
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --hours=*) HOURS="${arg#*=}" ;;
    --dry-run) DRY_RUN=1 ;;
    *) echo "Unknown arg: $arg" >&2; exit 1 ;;
  esac
done

# Auth
if [ -z "${GH_TOKEN:-}" ] && [ -f "${HOME}/.claude/hooks/github.env" ]; then
  # shellcheck disable=SC1091
  source "${HOME}/.claude/hooks/github.env"
  export GH_TOKEN
fi
if [ -z "${GH_TOKEN:-}" ]; then
  echo "ERROR: GH_TOKEN not set (and ~/.claude/hooks/github.env not readable)" >&2
  exit 1
fi

# User-facing batches that directly affect dashboard / 社長 experience
# (これらが落ちると Today 画面の表示や名言・前奏・ニュース・ナレーターが欠ける)
HIGH_WORKFLOWS=(
  "Morning Quote (Daily)"
  "Proactive Preparation (Daily)"
  "News Collection"
  "Narrator Update (Daily)"
  "Intelligence Collection"
)

is_high_severity() {
  local name="$1"
  for w in "${HIGH_WORKFLOWS[@]}"; do
    [[ "$name" == "$w" ]] && return 0
  done
  return 1
}

# 除外: on-demand / interactive な workflow（社長がメンションで起動するもの等）
# これらは「定時バッチが silent failure」とは性質が違うので growth に上げない
EXCLUDED_WORKFLOWS=(
  "Claude Code Action"
  "Workflow Failure Watch"  # 自分自身（失敗ループ防止）
)

is_excluded() {
  local name="$1"
  for w in "${EXCLUDED_WORKFLOWS[@]}"; do
    [[ "$name" == "$w" ]] && return 0
  done
  return 1
}

SINCE=$(date -u -d "${HOURS} hours ago" '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null \
        || date -u -v-"${HOURS}"H '+%Y-%m-%dT%H:%M:%SZ')

# Filter by conclusion + createdAt with jq.
# gh's --status flag is unreliable across versions, so we filter client-side.
failures=$(gh run list \
  --limit=100 \
  --json databaseId,name,createdAt,conclusion,workflowName,url 2>/dev/null \
  | jq --arg since "$SINCE" '[.[] | select(.conclusion == "failure" and .createdAt >= $since)]' \
  || echo "[]")

count=$(echo "$failures" | jq 'length')
if [ "$count" -eq 0 ]; then
  echo "✓ No workflow failures in the last ${HOURS}h"
  exit 0
fi

echo "⚠ Found ${count} failed workflow run(s) in the last ${HOURS}h"

echo "$failures" | jq -c '.[]' | while read -r run; do
  name=$(echo "$run" | jq -r '.workflowName // .name')
  if is_excluded "$name"; then continue; fi

  created=$(echo "$run" | jq -r '.createdAt')
  url=$(echo "$run" | jq -r '.url')
  run_id=$(echo "$run" | jq -r '.databaseId')

  severity=medium
  is_high_severity "$name" && severity=high

  date_str="${created:0:10}"
  title="[batch failure] ${name} (${date_str})"
  what_happened="GitHub Actions workflow '${name}' failed at ${created}. Run URL: ${url}. Diagnose with: gh run view ${run_id} --log-failed"

  if [ "$DRY_RUN" -eq 1 ]; then
    echo "  [dry-run] would record: ${title} (severity=${severity})"
    continue
  fi

  bash "${SCRIPT_DIR}/record.sh" failure claude-dev "${title}" \
    --what-happened="${what_happened}" \
    --category=devops \
    --severity="${severity}" \
    --tags=github-actions,batch,silent-failure 2>&1 | tail -3 || true
done

echo "✓ Workflow failure check complete"
