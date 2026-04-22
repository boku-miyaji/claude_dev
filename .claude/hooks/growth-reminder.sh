#!/usr/bin/env bash
# growth-reminder.sh — PostToolUse Hook
#
# 重要ファイル（supabase/functions/, .claude/hooks/, .claude/rules/,
# supabase/migrations/, supabase-migration-*）の編集を検知したら、
# Claude に「growth_events への記録候補ではないか」とリマインドする。
#
# - ブロックしない（終了コード 0 で抜ける）
# - ノイズを避けるため、同じファイルのリマインドは24時間に1回までに抑制
#
# Input: stdin から Claude Code の tool call JSON
# Output: stderr にリマインド（Claude の次のターンに context として渡る）

set -uo pipefail

INPUT=$(cat)

FILE=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    ti = d.get('tool_input', {}) or {}
    print(ti.get('file_path') or ti.get('path') or '')
except Exception:
    print('')
" 2>/dev/null)

[ -z "$FILE" ] && exit 0

# Match significant paths
REMIND=""
case "$FILE" in
  */supabase/functions/*)
    REMIND="Edge Function を変更した。設計判断なら \`decision\`、障害対応なら \`countermeasure\` として growth_events に記録する候補" ;;
  */.claude/hooks/*.sh)
    REMIND="Hook を変更した。運用改善の意思決定なら \`decision\` として growth_events に記録する候補" ;;
  */.claude/rules/*.md)
    REMIND="運用ルールを変更した。方針決定として growth_events に \`decision\` で記録する候補" ;;
  */supabase/migrations/*|*/supabase-migration-*.sql)
    REMIND="DB マイグレーションを追加した。アーキテクチャ決定として growth_events に \`decision\` で記録する候補" ;;
  */.company/*/CLAUDE.md)
    REMIND="部署 CLAUDE.md を変更した。組織設計の \`decision\` として記録する候補" ;;
esac

[ -z "$REMIND" ] && exit 0

# Throttle: only once per 24h per file
STATE_DIR="${HOME}/.claude/.state/growth-reminder"
mkdir -p "$STATE_DIR"
HASH=$(echo -n "$FILE" | md5sum | awk '{print $1}' | head -c 10)
MARKER="$STATE_DIR/$HASH"

if [ -f "$MARKER" ]; then
  LAST=$(stat -c %Y "$MARKER" 2>/dev/null || stat -f %m "$MARKER" 2>/dev/null || echo 0)
  NOW=$(date +%s)
  AGE=$((NOW - LAST))
  if [ "$AGE" -lt 86400 ]; then
    exit 0
  fi
fi

touch "$MARKER"

# Emit reminder to stderr (surfaces in Claude's next turn)
echo "💡 growth-reminder: $REMIND" >&2
echo "   file: $FILE" >&2
echo "   記録: bash scripts/growth/record.sh <type> <project_tag> \"<title>\" ..." >&2

exit 0
