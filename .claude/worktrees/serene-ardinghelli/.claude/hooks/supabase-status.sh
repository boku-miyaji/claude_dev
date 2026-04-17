#!/bin/bash
# Hook: SessionStart → Check Supabase connectivity and warn user
# This hook is NOT async so the warning is visible to the user.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Read stdin (hook input) but we don't need it
cat > /dev/null

# Source the shared check (sets SUPABASE_AVAILABLE and SUPABASE_MISSING_REASON)
source "$SCRIPT_DIR/supabase-check.sh"

if [ "$SUPABASE_AVAILABLE" != "true" ]; then
  echo ""
  echo "⚠️  Supabase 未接続: ${SUPABASE_MISSING_REASON:-unknown}"
  echo "   → プロンプト記録・設定同期・タスク管理が無効です"
  echo "   → セットアップ: cp .claude/hooks/supabase.env.example .claude/hooks/supabase.env && vi .claude/hooks/supabase.env"
  echo ""
fi

exit 0
