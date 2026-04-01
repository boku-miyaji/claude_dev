#!/bin/bash
# validate-registry.sh — レジストリ整合性チェック（読み取り専用）
# /company 起動時に実行。不整合を検出してJSON出力する。修復はしない。
set -uo pipefail

WORKSPACE="${1:-/workspace}"
REGISTRY="$WORKSPACE/.company/registry.md"
ISSUES=()

add_issue() {
  local sev="$1" type="$2" msg="$3"
  ISSUES+=("{\"severity\":\"$sev\",\"type\":\"$type\",\"message\":\"$msg\"}")
}

# ── 1. registry.md の会社一覧 vs .company-*/ ディレクトリ ──

# Parse company IDs from registry.md (between COMPANY_TABLE markers or fallback)
REGISTRY_COMPANIES=""
if [ -f "$REGISTRY" ]; then
  REGISTRY_COMPANIES=$(awk -F'|' '/^\|[[:space:]]+[a-z]/ && !/ID/ {gsub(/[[:space:]]/,"",$2); if($2!="") print $2}' "$REGISTRY" | sort)
fi

# Actual .company-*/ directories
LOCAL_COMPANIES=$(find "$WORKSPACE" -maxdepth 1 -type d -name '.company-*' 2>/dev/null | \
  sed "s|$WORKSPACE/.company-||" | sort)

# Check: registry has entry but no directory
for id in $REGISTRY_COMPANIES; do
  if ! echo "$LOCAL_COMPANIES" | grep -qx "$id"; then
    add_issue "error" "missing_directory" "${id}: registry.md に記載あるが .company-${id}/ が存在しない"
  fi
done

# Check: directory exists but not in registry
for id in $LOCAL_COMPANIES; do
  if ! echo "$REGISTRY_COMPANIES" | grep -qx "$id"; then
    add_issue "error" "missing_registry" "${id}: .company-${id}/ が存在するが registry.md に記載なし"
  fi
done

# ── 2. registry.md の部署テーブル vs departments/*/ ──

REGISTRY_DEPTS=""
if [ -f "$REGISTRY" ]; then
  REGISTRY_DEPTS=$(grep -E '^\| .+ \| departments/' "$REGISTRY" | grep -oP 'departments/\K[a-z-]+' | sort)
fi

LOCAL_DEPTS=$(find "$WORKSPACE/.company/departments" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | \
  xargs -I{} basename {} | sort)

for dept in $LOCAL_DEPTS; do
  if ! echo "$REGISTRY_DEPTS" | grep -qx "$dept"; then
    add_issue "warning" "dept_not_in_registry" "${dept}: departments/${dept}/ が存在するが registry.md の部署テーブルに記載なし"
  fi
done

for dept in $REGISTRY_DEPTS; do
  if ! echo "$LOCAL_DEPTS" | grep -qx "$dept"; then
    add_issue "error" "dept_missing_directory" "${dept}: registry.md に記載あるが departments/${dept}/ が存在しない"
  fi
done

# ── 3. CLAUDE.md マーカーの存在確認 ──

CLAUDE_MD="$WORKSPACE/.company/CLAUDE.md"
if [ -f "$CLAUDE_MD" ]; then
  for marker in ARCH_TREE AGENT_TABLE; do
    if ! grep -q "GENERATED:${marker}:START" "$CLAUDE_MD"; then
      add_issue "warning" "missing_marker" "CLAUDE.md に GENERATED:${marker} マーカーが存在しない"
    fi
  done
fi

# ── 4. task-classification.md マーカーの存在確認 ──

TASK_CLASS="$WORKSPACE/.company/secretary/policies/task-classification.md"
if [ -f "$TASK_CLASS" ]; then
  for marker in SCOPE_TAGS DEPT_TAGS; do
    if ! grep -q "GENERATED:${marker}:START" "$TASK_CLASS"; then
      add_issue "warning" "missing_marker" "task-classification.md に GENERATED:${marker} マーカーが存在しない"
    fi
  done

  # Check all companies in scope tags
  for id in $REGISTRY_COMPANIES; do
    if ! grep -q "pj:${id}" "$TASK_CLASS"; then
      add_issue "warning" "scope_tag_missing" "task-classification.md の軸1に pj:${id} が存在しない"
    fi
  done
fi

# ── 5. prompt-log.sh に全会社のパターンがあるか ──

PROMPT_LOG="$WORKSPACE/.claude/hooks/prompt-log.sh"
if [ -f "$PROMPT_LOG" ]; then
  for id in $REGISTRY_COMPANIES; do
    if ! grep -q "COMPANY_ID=\"${id}\"" "$PROMPT_LOG"; then
      add_issue "warning" "prompt_pattern_missing" "prompt-log.sh に ${id} の推定パターンが存在しない"
    fi
  done
fi

# ── 6. Supabase との差分（接続可能時のみ） ──

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$WORKSPACE/.claude/hooks/supabase-check.sh" ]; then
  source "$WORKSPACE/.claude/hooks/supabase-check.sh" 2>/dev/null || true
fi

if [ "${SUPABASE_AVAILABLE:-false}" = "true" ]; then
  SB_COMPANIES=$(curl -4 -s "${SUPABASE_URL}/rest/v1/companies?select=id&status=eq.active&order=id.asc" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "x-ingest-key: ${SUPABASE_INGEST_KEY}" \
    --connect-timeout 3 --max-time 5 2>/dev/null || echo "[]")

  SB_IDS=$(echo "$SB_COMPANIES" | jq -r '.[].id' 2>/dev/null | sort)

  for id in $REGISTRY_COMPANIES; do
    if ! echo "$SB_IDS" | grep -qx "$id"; then
      add_issue "warning" "supabase_missing" "${id}: registry.md にあるが Supabase companies テーブルに未登録"
    fi
  done
fi

# ── 結果出力 ──

ISSUE_COUNT=${#ISSUES[@]}
STATUS="consistent"
[ "$ISSUE_COUNT" -gt 0 ] && STATUS="inconsistent"

ISSUES_JSON="[]"
if [ "$ISSUE_COUNT" -gt 0 ]; then
  ISSUES_JSON=$(printf '%s\n' "${ISSUES[@]}" | jq -s .)
fi

jq -n \
  --arg status "$STATUS" \
  --arg checked_at "$(TZ=Asia/Tokyo date +%Y-%m-%d)" \
  --argjson issues "$ISSUES_JSON" \
  '{status: $status, checked_at: $checked_at, issues: $issues}'
