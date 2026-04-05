#!/bin/bash
# Hook: SessionStart — ドキュメントとコードの整合性チェック
# how-it-works.html / docs/ai-features/ が実装と乖離していないか検証
# 問題があればセッション開始時に警告を表示

set -uo pipefail

DASHBOARD_DIR="/workspace/company-dashboard"

# Skip if dashboard doesn't exist
[ -d "$DASHBOARD_DIR" ] || exit 0

cd "$DASHBOARD_DIR" || exit 0

ERRORS=0
WARNINGS=""

check() {
  local file="$1"
  local pattern="$2"
  local desc="$3"
  if [ ! -f "$file" ]; then
    WARNINGS="${WARNINGS}  ✗ ファイル消失: $file ($desc)\n"
    ERRORS=$((ERRORS + 1))
    return
  fi
  if ! grep -q "$pattern" "$file" 2>/dev/null; then
    WARNINGS="${WARNINGS}  ✗ 関数/定数が見つからない: $desc (in $file)\n"
    ERRORS=$((ERRORS + 1))
  fi
}

# --- AI機能のソースコード存在チェック ---
check "src/hooks/useEmotionAnalysis.ts" "export function useEmotionAnalysis" "感情分析hook"
check "src/hooks/useSelfAnalysis.ts" "export function useSelfAnalysis" "自己分析hook"
check "src/hooks/useSelfAnalysis.ts" "function collectData" "データ収集関数"
check "src/hooks/useSelfAnalysis.ts" "function getPreviousAnalysis" "差分分析関数"
check "src/hooks/useMorningBriefing.ts" "export function useMorningBriefing" "朝の一言hook"
check "src/hooks/useDreamDetection.ts" "export function useDreamDetection" "夢検出hook"
check "src/hooks/useWeeklyNarrative.ts" "export function useWeeklyNarrative" "週次ナラティブhook"
check "src/lib/edgeAi.ts" "export async function aiCompletion" "AI呼び出し関数"

# --- ドキュメント存在チェック ---
check "how-it-works.html" "ai-features" "how-it-works AI機能セクション"
check "how-it-works.html" "ai-emotion" "how-it-works 感情分析"
check "how-it-works.html" "ai-self" "how-it-works 自己分析"
check "how-it-works.html" "ai-briefing" "how-it-works 朝の一言"

# --- Sidebarのタブ順序チェック (上流→下流) ---
if [ -f "src/components/layout/Sidebar.tsx" ]; then
  # Today should appear before Tasks, Tasks before Insights
  TODAY_LINE=$(grep -n "page: ''" src/components/layout/Sidebar.tsx | head -1 | cut -d: -f1)
  TASKS_LINE=$(grep -n "page: 'tasks'" src/components/layout/Sidebar.tsx | head -1 | cut -d: -f1)
  INSIGHTS_LINE=$(grep -n "page: 'insights'" src/components/layout/Sidebar.tsx | head -1 | cut -d: -f1)
  if [ -n "$TODAY_LINE" ] && [ -n "$TASKS_LINE" ] && [ -n "$INSIGHTS_LINE" ]; then
    if [ "$TODAY_LINE" -gt "$TASKS_LINE" ] || [ "$TASKS_LINE" -gt "$INSIGHTS_LINE" ]; then
      WARNINGS="${WARNINGS}  ✗ サイドバーのタブ順序が上流→下流になっていない\n"
      ERRORS=$((ERRORS + 1))
    fi
  fi
fi

# --- how-it-works.html の最終更新日チェック ---
if [ -f "how-it-works.html" ]; then
  # Check if any AI hook is newer than how-it-works.html
  HOW_MTIME=$(stat -c %Y how-it-works.html 2>/dev/null || echo 0)
  for hook_file in src/hooks/useEmotionAnalysis.ts src/hooks/useSelfAnalysis.ts src/hooks/useMorningBriefing.ts src/hooks/useDreamDetection.ts src/hooks/useWeeklyNarrative.ts; do
    if [ -f "$hook_file" ]; then
      HOOK_MTIME=$(stat -c %Y "$hook_file" 2>/dev/null || echo 0)
      if [ "$HOOK_MTIME" -gt "$HOW_MTIME" ]; then
        HOOK_NAME=$(basename "$hook_file")
        WARNINGS="${WARNINGS}  ⚠ $HOOK_NAME が how-it-works.html より新しい → ドキュメント更新が必要かもしれません\n"
        ERRORS=$((ERRORS + 1))
        break
      fi
    fi
  done
fi

if [ $ERRORS -gt 0 ]; then
  echo -e "📄 ドキュメント整合性チェック: ${ERRORS}件の問題\n${WARNINGS}" >&2
fi

exit 0
