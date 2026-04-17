# ドキュメント同期チェック

> 最終更新: 2026-04-05

ドキュメントに記載されたファイルパス・関数名がコードと一致しているか検証するためのチェックリストです。

## 検証コマンド

以下のコマンドを `company-dashboard/` ディレクトリで実行してください。

### 1. ソースファイルの存在確認

```bash
# 全フックファイルの存在確認
ls -la \
  src/hooks/useEmotionAnalysis.ts \
  src/hooks/useSelfAnalysis.ts \
  src/hooks/useMorningBriefing.ts \
  src/hooks/useDreamDetection.ts \
  src/hooks/useWeeklyNarrative.ts \
  src/lib/edgeAi.ts \
  src/lib/aiPartner.ts \
  src/stores/briefing.ts \
  src/pages/SelfAnalysis.tsx \
  src/pages/Today.tsx
```

### 2. エクスポート関数の存在確認

```bash
# useEmotionAnalysis
grep -n "export function useEmotionAnalysis" src/hooks/useEmotionAnalysis.ts
grep -n "EMOTION_ANALYSIS_PROMPT" src/hooks/useEmotionAnalysis.ts

# useSelfAnalysis
grep -n "export function useSelfAnalysis" src/hooks/useSelfAnalysis.ts
grep -n "function collectData" src/hooks/useSelfAnalysis.ts
grep -n "function getPreviousAnalysis" src/hooks/useSelfAnalysis.ts
grep -n "function mbtiPrompt" src/hooks/useSelfAnalysis.ts
grep -n "function big5Prompt" src/hooks/useSelfAnalysis.ts
grep -n "function strengthsFinderPrompt" src/hooks/useSelfAnalysis.ts
grep -n "function emotionTriggersPrompt" src/hooks/useSelfAnalysis.ts
grep -n "function valuesPrompt" src/hooks/useSelfAnalysis.ts

# useMorningBriefing
grep -n "export function useMorningBriefing" src/hooks/useMorningBriefing.ts
grep -n "function getFallback" src/hooks/useMorningBriefing.ts

# useDreamDetection
grep -n "export function useDreamDetection" src/hooks/useDreamDetection.ts
grep -n "export interface DreamDetection" src/hooks/useDreamDetection.ts

# useWeeklyNarrative
grep -n "export function useWeeklyNarrative" src/hooks/useWeeklyNarrative.ts
grep -n "export interface WeeklyNarrativeRecord" src/hooks/useWeeklyNarrative.ts
grep -n "export interface WeekInfo" src/hooks/useWeeklyNarrative.ts
grep -n "function getMonday" src/hooks/useWeeklyNarrative.ts

# edgeAi
grep -n "export async function aiCompletion" src/lib/edgeAi.ts

# aiPartner
grep -n "export function buildPartnerSystemPrompt" src/lib/aiPartner.ts
grep -n "export function getTimeOfDay" src/lib/aiPartner.ts

# briefing store
grep -n "export const useBriefingStore" src/stores/briefing.ts

# SelfAnalysis page
grep -n "function MbtiResult" src/pages/SelfAnalysis.tsx
grep -n "function Big5Result" src/pages/SelfAnalysis.tsx
grep -n "function StrengthsFinderResult" src/pages/SelfAnalysis.tsx
grep -n "function ValuesResult" src/pages/SelfAnalysis.tsx
grep -n "function ChangesFromPrevious" src/pages/SelfAnalysis.tsx
grep -n "function AnalysisResultView" src/pages/SelfAnalysis.tsx

# Today page
grep -n "PLUTCHIK_LABELS" src/pages/Today.tsx
grep -n "EmotionBadge" src/pages/Today.tsx
grep -n "saveEntry" src/pages/Today.tsx
```

### 3. DB テーブル参照の確認

```bash
# 各テーブルへの参照確認
grep -rn "from('emotion_analysis')" src/hooks/ src/pages/
grep -rn "from('self_analysis')" src/hooks/ src/pages/
grep -rn "from('weekly_narratives')" src/hooks/ src/pages/
grep -rn "from('diary_entries')" src/hooks/useEmotionAnalysis.ts src/hooks/useMorningBriefing.ts src/hooks/useWeeklyNarrative.ts
grep -rn "from('dreams')" src/hooks/useDreamDetection.ts src/hooks/useSelfAnalysis.ts src/hooks/useMorningBriefing.ts
grep -rn "from('prompt_log')" src/hooks/useSelfAnalysis.ts src/hooks/useMorningBriefing.ts
grep -rn "from('tasks')" src/hooks/useSelfAnalysis.ts src/hooks/useMorningBriefing.ts src/hooks/useWeeklyNarrative.ts
grep -rn "from('ceo_insights')" src/hooks/useMorningBriefing.ts
grep -rn "from('goals')" src/hooks/useWeeklyNarrative.ts
grep -rn "from('habits')" src/hooks/useWeeklyNarrative.ts
grep -rn "from('habit_logs')" src/hooks/useWeeklyNarrative.ts
grep -rn "from('calendar_events')" src/hooks/useSelfAnalysis.ts
```

### 4. Edge Function 呼び出しパラメータの確認

```bash
# aiCompletion の呼び出し箇所とパラメータ
grep -A5 "aiCompletion" src/hooks/useEmotionAnalysis.ts
grep -A5 "aiCompletion" src/hooks/useSelfAnalysis.ts
grep -A5 "aiCompletion" src/hooks/useMorningBriefing.ts
grep -A5 "aiCompletion" src/hooks/useDreamDetection.ts
grep -A5 "aiCompletion" src/hooks/useWeeklyNarrative.ts
```

### 5. 一括検証スクリプト

```bash
#!/bin/bash
# sync-check.sh — ドキュメントとコードの同期検証

cd "$(dirname "$0")/../.." || exit 1

ERRORS=0

check() {
  local file="$1"
  local pattern="$2"
  local desc="$3"
  if ! grep -q "$pattern" "$file" 2>/dev/null; then
    echo "FAIL: $desc"
    echo "  file: $file"
    echo "  pattern: $pattern"
    ERRORS=$((ERRORS + 1))
  fi
}

# Hooks
check "src/hooks/useEmotionAnalysis.ts" "export function useEmotionAnalysis" "useEmotionAnalysis export"
check "src/hooks/useEmotionAnalysis.ts" "EMOTION_ANALYSIS_PROMPT" "emotion prompt constant"
check "src/hooks/useSelfAnalysis.ts" "export function useSelfAnalysis" "useSelfAnalysis export"
check "src/hooks/useSelfAnalysis.ts" "function collectData" "collectData function"
check "src/hooks/useSelfAnalysis.ts" "function getPreviousAnalysis" "getPreviousAnalysis function"
check "src/hooks/useMorningBriefing.ts" "export function useMorningBriefing" "useMorningBriefing export"
check "src/hooks/useDreamDetection.ts" "export function useDreamDetection" "useDreamDetection export"
check "src/hooks/useWeeklyNarrative.ts" "export function useWeeklyNarrative" "useWeeklyNarrative export"

# Libs
check "src/lib/edgeAi.ts" "export async function aiCompletion" "aiCompletion export"
check "src/lib/aiPartner.ts" "export function buildPartnerSystemPrompt" "buildPartnerSystemPrompt export"
check "src/stores/briefing.ts" "export const useBriefingStore" "briefingStore export"

# Pages
check "src/pages/SelfAnalysis.tsx" "function MbtiResult" "MbtiResult component"
check "src/pages/SelfAnalysis.tsx" "function AnalysisResultView" "AnalysisResultView component"
check "src/pages/Today.tsx" "PLUTCHIK_LABELS" "PLUTCHIK_LABELS constant"

if [ $ERRORS -eq 0 ]; then
  echo "ALL CHECKS PASSED"
else
  echo "$ERRORS check(s) failed"
  exit 1
fi
```

## チェック実行タイミング

- AI機能のソースコードを変更した後
- ドキュメントを更新した後
- PR レビュー時
