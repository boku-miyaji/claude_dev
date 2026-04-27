#!/usr/bin/env bash
# scripts/growth/record.sh — growth_events への手動INSERT
#
# 重複チェック + PJタグ妥当性チェック + ドメインタグ warning を経由して INSERT する。
# 原則、直接 curl で INSERT せずこのスクリプトを使う。
#
# Usage:
#   record.sh <event_type> <project_tag> <title> [options]
#
# event_type:   failure | countermeasure | decision | milestone
# project_tag:  claude-dev | focus-you | polaris-circuit | rikyu | agent-harness
#
# Options:
#   --category=<c>         security|architecture|devops|automation|tooling|
#                          organization|process|quality|communication
#                          (default: process)
#   --severity=<s>         critical|high|medium|low (default: medium)
#   --tags=<t1,t2>         追加ドメインタグ（カンマ区切り）
#   --what-happened=<s>    何が起きたか（必須: failure/milestone）
#   --root-cause=<s>       原因
#   --countermeasure=<s>   対策
#   --result=<s>           結果
#   --parent-id=<uuid>     親レコードID（failure → countermeasure の関係）
#   --status=<s>           active|resolved|recurring|superseded (default: active)
#   --event-date=<date>    デフォルト: 今日
#   --dry-run              INSERT せず JSON を表示
#   --force                重複 title があっても強制 INSERT
#
# Examples:
#   record.sh decision claude-dev "コスト分離の原則" \
#     --what-happened="ダッシュボード=gpt-5-nano、バッチ=Claude CLI、Hook=API禁止" \
#     --category=architecture --tags=cost,llm-prompt
#
#   record.sh countermeasure claude-dev "verify_jwt=false を認証標準化" \
#     --parent-id=<failure-uuid> --category=security

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="${REPO_DIR:-/workspace}"
TAGS_YAML="$REPO_DIR/.company/growth-tags.yaml"

# If SUPABASE_URL is already in env (e.g. GitHub Actions secrets injection),
# skip sourcing the local env file. Otherwise load from ~/.claude/hooks/supabase.env.
if [ -z "${SUPABASE_URL:-}" ]; then
  source ~/.claude/hooks/supabase.env 2>/dev/null || {
    echo "Error: SUPABASE_URL not in env and supabase.env not found" >&2; exit 2
  }
fi

usage() { sed -n '2,28p' "$0" | sed 's/^# //; s/^#//'; }

# ------------- Parse args -------------
EVENT_TYPE="${1:-}"
PROJECT_TAG="${2:-}"
TITLE="${3:-}"

[ -z "$EVENT_TYPE" ] && { usage; exit 1; }
[ -z "$PROJECT_TAG" ] && { usage; exit 1; }
[ -z "$TITLE" ] && { usage; exit 1; }
shift 3

CATEGORY="process"
SEVERITY="medium"
STATUS="active"
TAGS_EXTRA=""
WHAT_HAPPENED=""
ROOT_CAUSE=""
COUNTERMEASURE=""
RESULT=""
PARENT_ID=""
EVENT_DATE="$(date +%Y-%m-%d)"
DRY_RUN=""
FORCE=""

for arg in "$@"; do
  case "$arg" in
    --category=*)        CATEGORY="${arg#*=}" ;;
    --severity=*)        SEVERITY="${arg#*=}" ;;
    --status=*)          STATUS="${arg#*=}" ;;
    --tags=*)            TAGS_EXTRA="${arg#*=}" ;;
    --what-happened=*)   WHAT_HAPPENED="${arg#*=}" ;;
    --root-cause=*)      ROOT_CAUSE="${arg#*=}" ;;
    --countermeasure=*)  COUNTERMEASURE="${arg#*=}" ;;
    --result=*)          RESULT="${arg#*=}" ;;
    --parent-id=*)       PARENT_ID="${arg#*=}" ;;
    --event-date=*)      EVENT_DATE="${arg#*=}" ;;
    --dry-run)           DRY_RUN=1 ;;
    --force)             FORCE=1 ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

# ------------- Validate event_type -------------
case "$EVENT_TYPE" in
  failure|countermeasure|decision|milestone) ;;
  *)
    echo "Error: event_type must be one of: failure, countermeasure, decision, milestone" >&2
    exit 1
    ;;
esac

# ------------- Validate project_tag against growth-tags.yaml -------------
if [ -f "$TAGS_YAML" ]; then
  VALID_PROJECTS=$(python3 -c "
import yaml
with open('$TAGS_YAML') as f:
    d = yaml.safe_load(f)
for k in d.get('project', {}).get('values', {}).keys():
    print(k)
" 2>/dev/null)

  if ! echo "$VALID_PROJECTS" | grep -qx "$PROJECT_TAG"; then
    echo "Error: project_tag '$PROJECT_TAG' is not in growth-tags.yaml" >&2
    echo "Valid: $(echo $VALID_PROJECTS | tr '\n' ' ')" >&2
    exit 1
  fi
else
  echo "Warning: $TAGS_YAML not found, skipping project tag validation" >&2
fi

# ------------- Warn on unknown domain tags -------------
if [ -n "$TAGS_EXTRA" ] && [ -f "$TAGS_YAML" ]; then
  VALID_DOMAINS=$(python3 -c "
import yaml
with open('$TAGS_YAML') as f:
    d = yaml.safe_load(f)
for k in d.get('domain', {}).get('values', {}).keys():
    print(k)
" 2>/dev/null)

  for t in $(echo "$TAGS_EXTRA" | tr ',' ' '); do
    if ! echo "$VALID_DOMAINS" | grep -qx "$t"; then
      echo "Warning: domain tag '$t' is not in growth-tags.yaml (accepted with warning)" >&2
    fi
  done
fi

# ------------- Duplicate check (title + past 7 days) -------------
if [ -z "$FORCE" ]; then
  SINCE=$(date -d "7 days ago" +%Y-%m-%d)
  TITLE_ENCODED=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$TITLE")
  DUP=$(curl -s "${SUPABASE_URL}/rest/v1/growth_events?title=eq.${TITLE_ENCODED}&event_date=gte.${SINCE}&select=id,event_date,event_type" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "x-ingest-key: ${SUPABASE_INGEST_KEY:-}" 2>/dev/null)

  if [ -n "$DUP" ] && [ "$DUP" != "[]" ]; then
    echo "Warning: duplicate title found within last 7 days:" >&2
    echo "$DUP" >&2
    echo "Use --force to override, or change the title." >&2
    exit 1
  fi
fi

# ------------- Build payload -------------
TAGS_ARRAY=$(python3 -c "
import json
extra = '''$TAGS_EXTRA'''.split(',') if '''$TAGS_EXTRA''' else []
tags = ['$PROJECT_TAG'] + [t.strip() for t in extra if t.strip()] + ['manual-record']
# dedupe preserving order
seen = set()
uniq = []
for t in tags:
    if t not in seen:
        seen.add(t); uniq.append(t)
print(json.dumps(uniq, ensure_ascii=False))
")

PAYLOAD=$(python3 -c "
import json, os
payload = {
    'event_date': '$EVENT_DATE',
    'event_type': '$EVENT_TYPE',
    'category': '$CATEGORY',
    'severity': '$SEVERITY',
    'title': '''$TITLE''',
    'what_happened': '''$WHAT_HAPPENED''',
    'status': '$STATUS',
    'source': 'manual',
    'tags': $TAGS_ARRAY,
}
if '''$ROOT_CAUSE''': payload['root_cause'] = '''$ROOT_CAUSE'''
if '''$COUNTERMEASURE''': payload['countermeasure'] = '''$COUNTERMEASURE'''
if '''$RESULT''': payload['result'] = '''$RESULT'''
if '$PARENT_ID': payload['parent_id'] = '$PARENT_ID'
print(json.dumps(payload, ensure_ascii=False))
")

# ------------- Dry run -------------
if [ -n "$DRY_RUN" ]; then
  echo "$PAYLOAD" | python3 -m json.tool
  exit 0
fi

# ------------- INSERT -------------
RES=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/growth_events" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "x-ingest-key: ${SUPABASE_INGEST_KEY:-}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "$PAYLOAD")

if echo "$RES" | grep -q '"id"'; then
  ID=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")
  echo "✓ Inserted: $ID"
  echo "  title: $TITLE"
  echo "  type: $EVENT_TYPE / project: $PROJECT_TAG / category: $CATEGORY"
else
  echo "Error: INSERT failed" >&2
  echo "$RES" >&2
  exit 1
fi
