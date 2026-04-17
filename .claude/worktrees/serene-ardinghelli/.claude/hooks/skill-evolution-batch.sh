#!/bin/bash
# skill-evolution-batch.sh — prompt_log からスキル候補を自動検出・蓄積するバッチ
#
# 実行タイミング:
#   - 手動: bash .claude/hooks/skill-evolution-batch.sh
#   - /company ブリーフィング時に秘書が判断して実行
#
# 処理フロー:
#   1. prompt_log から直近のプロンプトを取得（前回バッチ以降）
#   2. 既存の skill_candidates を読み込む
#   3. LLM にパターン分析させる（新規検出 + 既存候補の count 更新）
#   4. skill_candidates テーブルを更新
#   5. 閾値到達した候補を報告

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/supabase-check.sh" 2>/dev/null || true
[ "${SUPABASE_AVAILABLE:-false}" = "true" ] || { echo "Supabase unavailable"; exit 1; }

LAST_RUN_FILE="$SCRIPT_DIR/.skill-evolution-last-run"
LAST_RUN=""
if [ -f "$LAST_RUN_FILE" ]; then
  LAST_RUN=$(cat "$LAST_RUN_FILE")
fi

# --- 24時間チェック（--force で強制実行） ---
if [ "${1:-}" != "--force" ] && [ -f "$LAST_RUN_FILE" ]; then
  LAST_EPOCH=$(date -d "$(cat "$LAST_RUN_FILE")" +%s 2>/dev/null || echo 0)
  NOW_EPOCH=$(date +%s)
  ELAPSED=$(( NOW_EPOCH - LAST_EPOCH ))
  if [ "$ELAPSED" -lt 86400 ]; then
    HOURS_AGO=$(( ELAPSED / 3600 ))
    echo "Last run ${HOURS_AGO}h ago (< 24h). Skip. Use --force to override."
    exit 0
  fi
fi

# --- Step 1: 直近のプロンプトを取得 ---
FILTER=""
if [ -n "$LAST_RUN" ]; then
  FILTER="&created_at=gt.${LAST_RUN}"
fi

# Fetch and sanitize prompts (control chars break jq)
PROMPTS_RAW=$(curl -4 -s \
  "${SUPABASE_URL}/rest/v1/prompt_log?select=prompt,created_at&order=created_at.desc&limit=100${FILTER}" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  --max-time 10 2>/dev/null)

PROMPTS_FILE=$(mktemp)
echo "$PROMPTS_RAW" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for d in data:
    if 'prompt' in d:
        # Strip XML tags (ide_opened_file etc.), keep just user text
        import re
        d['prompt'] = re.sub(r'<[^>]+>', '', d['prompt']).strip()
json.dump(data, sys.stdout, ensure_ascii=False)
" > "$PROMPTS_FILE" 2>/dev/null || echo "$PROMPTS_RAW" > "$PROMPTS_FILE"

PROMPT_COUNT=$(jq 'length' < "$PROMPTS_FILE" 2>/dev/null)
if [ -z "$PROMPT_COUNT" ] || [ "$PROMPT_COUNT" = "0" ] || [ "$PROMPT_COUNT" = "null" ]; then
  echo "No new prompts since last run"
  date -Iseconds > "$LAST_RUN_FILE"
  exit 0
fi

echo "Analyzing $PROMPT_COUNT new prompts..."

# --- Step 2: 既存の skill_candidates を読み込む ---
EXISTING=$(curl -4 -s \
  "${SUPABASE_URL}/rest/v1/skill_candidates?status=eq.candidate&select=id,pattern_name,pattern_description,detection_count,example_prompts" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  --max-time 10 2>/dev/null)

# --- Step 3: 既存スキル一覧を取得（重複防止） ---
EXISTING_SKILLS=$(curl -4 -s \
  "${SUPABASE_URL}/rest/v1/slash_commands?status=eq.active&select=trigger,description" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  --max-time 10 2>/dev/null)

# --- Step 4: Claude Code CLI でパターン分析 ---
PROMPTS_SUMMARY=$(jq -c '[.[:50][] | .prompt[:100]]' < "$PROMPTS_FILE")
EXISTING_SUMMARY=$(echo "$EXISTING" | jq -c '[.[] | {name: .pattern_name, desc: .pattern_description, count: .detection_count}]' 2>/dev/null || echo "[]")
SKILLS_SUMMARY=$(echo "$EXISTING_SKILLS" | jq -c '[.[] | {trigger: .trigger, desc: .description[:80]}]' 2>/dev/null || echo "[]")

CLAUDE_INPUT="Analyze user prompt history for recurring workflow patterns to automate as skills.

Good candidates:
- Multi-step workflow repeated 2+ times (e.g. research->summarize->slides)
- Same task asked in different words
- NOT one-off tasks, NOT simple questions, NOT system events (ide_opened_file)
- NOT patterns already covered by existing skills

Prompts: ${PROMPTS_SUMMARY}

Existing candidates (increment count if matched): ${EXISTING_SUMMARY}

Existing skills (avoid duplicates): ${SKILLS_SUMMARY}

Reply ONLY with valid JSON:
{\"new_candidates\":[{\"pattern_name\":\"kebab-case\",\"pattern_description\":\"desc\",\"example_prompts\":[\"p1\"]}],\"count_updates\":[{\"pattern_name\":\"name\",\"new_examples\":[\"prompt\"]}]}
Empty arrays are fine. Be conservative. JSON only."

ANALYSIS=$(echo "$CLAUDE_INPUT" | claude --print --model opus 2>/dev/null)

# Extract JSON (claude may wrap in markdown code blocks)
if echo "$ANALYSIS" | jq '.' >/dev/null 2>&1; then
  : # already valid JSON
else
  ANALYSIS=$(echo "$ANALYSIS" | sed -n '/^```/,/^```/p' | grep -v '^```' | tr -d '\n')
fi

if [ -z "$ANALYSIS" ] || ! echo "$ANALYSIS" | jq '.' >/dev/null 2>&1; then
  echo "Claude analysis returned invalid JSON"
  rm -f "$PROMPTS_FILE"
  date -Iseconds > "$LAST_RUN_FILE"
  exit 0
fi

# Parse response
NEW_CANDIDATES=$(echo "$ANALYSIS" | jq -c '.new_candidates // []' 2>/dev/null)
COUNT_UPDATES=$(echo "$ANALYSIS" | jq -c '.count_updates // []' 2>/dev/null)

# --- Step 5: 新規候補を INSERT ---
NEW_COUNT=$(echo "$NEW_CANDIDATES" | jq 'length' 2>/dev/null)
if [ "$NEW_COUNT" != "0" ] && [ "$NEW_COUNT" != "null" ] && [ -n "$NEW_COUNT" ]; then
  echo "$NEW_CANDIDATES" | jq -c '.[]' | while IFS= read -r candidate; do
    NAME=$(echo "$candidate" | jq -r '.pattern_name')
    DESC=$(echo "$candidate" | jq -r '.pattern_description')
    EXAMPLES=$(echo "$candidate" | jq -c '.example_prompts')

    # 重複チェック（同名の候補が既にあるか）
    DUP=$(echo "$EXISTING" | jq --arg n "$NAME" '[.[] | select(.pattern_name == $n)] | length' 2>/dev/null)
    if [ "$DUP" != "0" ] && [ -n "$DUP" ]; then
      echo "  Skip duplicate: $NAME"
      continue
    fi

    PAYLOAD=$(jq -n \
      --arg name "$NAME" \
      --arg desc "$DESC" \
      --argjson examples "$EXAMPLES" \
      '{pattern_name: $name, pattern_description: $desc, example_prompts: $examples}')

    curl -4 -s -o /dev/null \
      "${SUPABASE_URL}/rest/v1/skill_candidates" \
      -X POST \
      -H "apikey: ${SUPABASE_ANON_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
      -H "Content-Type: application/json" \
      -H "Prefer: return=minimal" \
      -d "$PAYLOAD" \
      --max-time 10 2>/dev/null || true

    echo "  New candidate: $NAME"
  done
fi

# --- Step 6: 既存候補の count を更新 ---
UPDATE_COUNT=$(echo "$COUNT_UPDATES" | jq 'length' 2>/dev/null)
if [ "$UPDATE_COUNT" != "0" ] && [ "$UPDATE_COUNT" != "null" ] && [ -n "$UPDATE_COUNT" ]; then
  echo "$COUNT_UPDATES" | jq -c '.[]' | while IFS= read -r update; do
    UNAME=$(echo "$update" | jq -r '.pattern_name')
    NEW_EX=$(echo "$update" | jq -c '.new_examples // []')

    # 現在の count と examples を取得
    CURRENT=$(echo "$EXISTING" | jq --arg n "$UNAME" '.[] | select(.pattern_name == $n)' 2>/dev/null)
    if [ -z "$CURRENT" ] || [ "$CURRENT" = "null" ]; then
      echo "  Skip unknown: $UNAME"
      continue
    fi

    CUR_COUNT=$(echo "$CURRENT" | jq '.detection_count')
    CUR_ID=$(echo "$CURRENT" | jq -r '.id')
    CUR_EXAMPLES=$(echo "$CURRENT" | jq -c '.example_prompts')
    NEW_COUNT_VAL=$((CUR_COUNT + 1))

    # examples をマージ（最大5件）
    MERGED_EXAMPLES=$(jq -n --argjson a "$CUR_EXAMPLES" --argjson b "$NEW_EX" \
      '($a + $b) | unique | .[:5]')

    PATCH=$(jq -n \
      --arg count "$NEW_COUNT_VAL" \
      --argjson examples "$MERGED_EXAMPLES" \
      '{detection_count: ($count | tonumber), example_prompts: $examples, updated_at: (now | todate)}')

    curl -4 -s -o /dev/null \
      "${SUPABASE_URL}/rest/v1/skill_candidates?id=eq.${CUR_ID}" \
      -X PATCH \
      -H "apikey: ${SUPABASE_ANON_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
      -H "Content-Type: application/json" \
      -H "Prefer: return=minimal" \
      -d "$PATCH" \
      --max-time 10 2>/dev/null || true

    echo "  Updated: $UNAME (count: $NEW_COUNT_VAL)"

    # --- 閾値チェック ---
    if [ "$NEW_COUNT_VAL" -ge 3 ]; then
      echo "  >>> THRESHOLD REACHED: $UNAME — ready for proposal!"

      curl -4 -s -o /dev/null \
        "${SUPABASE_URL}/rest/v1/skill_candidates?id=eq.${CUR_ID}" \
        -X PATCH \
        -H "apikey: ${SUPABASE_ANON_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
        -H "Content-Type: application/json" \
        -H "Prefer: return=minimal" \
        -d "{\"status\": \"proposed\", \"proposed_at\": \"$(date -Iseconds)\"}" \
        --max-time 10 2>/dev/null || true
    fi
  done
fi

# --- 記録 ---
rm -f "$PROMPTS_FILE"
date -Iseconds > "$LAST_RUN_FILE"
echo ""
echo "Skill evolution batch complete."
echo "  New candidates: ${NEW_COUNT:-0}"
echo "  Count updates: ${UPDATE_COUNT:-0}"

exit 0
