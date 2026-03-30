#!/bin/bash
# 鮮度チェックスクリプト
# /company 起動時に秘書が実行し、各データソースの最終更新日を取得する
# 出力: JSON形式の鮮度レポート（秘書がパースして判断に使う）

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/supabase-check.sh" 2>/dev/null || true

WORKSPACE="${CLAUDE_PROJECT_DIR:-/workspace}"
NOW_EPOCH=$(date +%s)
TODAY=$(TZ=Asia/Tokyo date +%Y-%m-%d)

# ── Supabase 系チェック ──

SB_RESULTS="{}"
if [ "${SUPABASE_AVAILABLE:-false}" = "true" ]; then

  # 1. ceo_insights: 最終分析日 + 未分析プロンプト数
  CEO_LAST=$(curl -4 -s "${SUPABASE_URL}/rest/v1/ceo_insights?select=created_at&order=created_at.desc&limit=1" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    --connect-timeout 3 --max-time 5 2>/dev/null || echo "[]")

  CEO_DATE=$(echo "$CEO_LAST" | jq -r '.[0].created_at // "never"' 2>/dev/null || echo "never")

  if [ "$CEO_DATE" != "never" ] && [ "$CEO_DATE" != "null" ]; then
    UNANALYZED=$(curl -4 -s "${SUPABASE_URL}/rest/v1/rpc/count_unanalyzed_prompts" \
      -X POST \
      -H "apikey: ${SUPABASE_ANON_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
      -H "Content-Type: application/json" \
      -d "{\"since_date\": \"${CEO_DATE}\"}" \
      --connect-timeout 3 --max-time 5 2>/dev/null || echo "0")
    # Fallback: direct count
    if [ "$UNANALYZED" = "0" ] || echo "$UNANALYZED" | grep -q "error"; then
      UNANALYZED=$(curl -4 -s "${SUPABASE_URL}/rest/v1/prompt_log?select=id&created_at=gt.${CEO_DATE}" \
        -H "apikey: ${SUPABASE_ANON_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
        -H "Prefer: count=exact" \
        -H "Range: 0-0" \
        -I --connect-timeout 3 --max-time 5 2>/dev/null | grep -i 'content-range' | sed 's/.*\///' | tr -d '[:space:]' || echo "?")
    fi
  else
    UNANALYZED="all"
  fi

  # 2. knowledge_base: 最終追加日 + active件数 + 昇格候補数
  KB_LAST=$(curl -4 -s "${SUPABASE_URL}/rest/v1/knowledge_base?select=created_at&status=eq.active&order=created_at.desc&limit=1" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    --connect-timeout 3 --max-time 5 2>/dev/null || echo "[]")
  KB_DATE=$(echo "$KB_LAST" | jq -r '.[0].created_at // "never"' 2>/dev/null || echo "never")

  KB_PROMO=$(curl -4 -s "${SUPABASE_URL}/rest/v1/knowledge_base?select=id&status=eq.active&confidence=gte.3" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "Prefer: count=exact" \
    -H "Range: 0-0" \
    -I --connect-timeout 3 --max-time 5 2>/dev/null | grep -i 'content-range' | sed 's/.*\///' | tr -d '[:space:]' || echo "0")

  # 3. diary_analysis: 最終分析日
  DIARY_LAST=$(curl -4 -s "${SUPABASE_URL}/rest/v1/diary_analysis?select=created_at&order=created_at.desc&limit=1" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    --connect-timeout 3 --max-time 5 2>/dev/null || echo "[]")
  DIARY_DATE=$(echo "$DIARY_LAST" | jq -r '.[0].created_at // "never"' 2>/dev/null || echo "never")

else
  CEO_DATE="unavailable"
  UNANALYZED="?"
  KB_DATE="unavailable"
  KB_PROMO="?"
  DIARY_DATE="unavailable"
fi

# ── ファイル系チェック ──

# 4. evaluations: 最新ファイルの日付
EVAL_LATEST=$(ls -t "$WORKSPACE/.company/hr/evaluations/"*.md 2>/dev/null | head -1)
if [ -n "$EVAL_LATEST" ]; then
  EVAL_DATE=$(basename "$EVAL_LATEST" | grep -oE '^[0-9]{4}-[0-9]{2}-[0-9]{2}' || echo "unknown")
else
  EVAL_DATE="never"
fi

# 5. intelligence reports: 最新レポートの日付
INTEL_LATEST=$(ls -t "$WORKSPACE/.company/departments/intelligence/reports/"*.md 2>/dev/null | head -1)
if [ -n "$INTEL_LATEST" ]; then
  INTEL_DATE=$(basename "$INTEL_LATEST" | grep -oE '^[0-9]{4}-[0-9]{2}-[0-9]{2}' || echo "unknown")
else
  INTEL_DATE="never"
fi

# 6. preferences.yaml: 最終更新
PREF_FILE="$WORKSPACE/.company/departments/intelligence/preferences.yaml"
if [ -f "$PREF_FILE" ]; then
  PREF_MTIME=$(TZ=Asia/Tokyo date -r "$PREF_FILE" +%Y-%m-%d 2>/dev/null || echo "unknown")
else
  PREF_MTIME="never"
fi

# 7. prep-log: FB未入力のMTG数（quality フィールドがないもの）
PREP_NO_FB=0
for f in "$WORKSPACE/.company/secretary/prep-log/"*.yaml 2>/dev/null; do
  [ -f "$f" ] || continue
  if ! grep -q "quality:" "$f" 2>/dev/null; then
    PREP_NO_FB=$((PREP_NO_FB + 1))
  fi
done

# ── 出力 ──

cat << ENDJSON
{
  "checked_at": "$TODAY",
  "supabase_available": ${SUPABASE_AVAILABLE:-false},
  "sources": {
    "ceo_insights": {
      "last_updated": "$CEO_DATE",
      "unanalyzed_prompts": "$UNANALYZED",
      "priority": 1
    },
    "knowledge_base": {
      "last_updated": "$KB_DATE",
      "promotion_candidates": "$KB_PROMO",
      "priority": 2
    },
    "evaluations": {
      "last_updated": "$EVAL_DATE",
      "priority": 3
    },
    "prep_log_feedback": {
      "missing_feedback_count": $PREP_NO_FB,
      "priority": 4
    },
    "intelligence_reports": {
      "last_updated": "$INTEL_DATE",
      "priority": 7
    },
    "preferences_yaml": {
      "last_updated": "$PREF_MTIME",
      "priority": 6
    },
    "diary_analysis": {
      "last_updated": "$DIARY_DATE",
      "priority": 8
    }
  }
}
ENDJSON
