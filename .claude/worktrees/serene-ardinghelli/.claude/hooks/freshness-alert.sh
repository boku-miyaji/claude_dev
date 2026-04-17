#!/bin/bash
# Hook: SessionStart — 鮮度アラート
# freshness-check.sh の結果を解析し、staleなデータがあればadditionalContextで警告
# async: true

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# freshness-check.sh を実行してJSONを取得
RESULT=$(bash "$SCRIPT_DIR/freshness-check.sh" 2>/dev/null) || exit 0

# JSON が空なら終了
[ -z "$RESULT" ] && exit 0

# stale 判定
ALERTS=""
NOW_EPOCH=$(date +%s)

check_age() {
  local name="$1" date="$2" max_days="$3" action="$4"
  [ "$date" = "never" ] || [ "$date" = "null" ] || [ -z "$date" ] && { ALERTS="${ALERTS}  - ${name}: 未実行 → ${action}\n"; return; }
  local date_epoch
  date_epoch=$(date -d "${date}" +%s 2>/dev/null || echo 0)
  local age_days=$(( (NOW_EPOCH - date_epoch) / 86400 ))
  if [ "$age_days" -gt "$max_days" ]; then
    ALERTS="${ALERTS}  - ${name}: ${age_days}日経過（上限${max_days}日）→ ${action}\n"
  fi
}

# 各データソースの鮮度チェック
CEO_DATE=$(echo "$RESULT" | jq -r '.sources.ceo_insights.last_updated // "never"' 2>/dev/null)
KB_DATE=$(echo "$RESULT" | jq -r '.sources.knowledge_base.last_updated // "never"' 2>/dev/null)
EVAL_DATE=$(echo "$RESULT" | jq -r '.sources.evaluations.last_updated // "never"' 2>/dev/null)
INTEL_DATE=$(echo "$RESULT" | jq -r '.sources.intelligence_reports.last_updated // "never"' 2>/dev/null)

check_age "CEO分析" "$CEO_DATE" 7 "prompt_logから行動パターン分析を実行"
check_age "部署評価" "$EVAL_DATE" 14 "人事部の5軸評価を実行"
check_age "情報収集" "$INTEL_DATE" 1 "最新ニュース収集を実行"

# 昇格候補チェック
KB_PROMO=$(echo "$RESULT" | jq -r '.sources.knowledge_base.promotion_candidates // "0"' 2>/dev/null)
if [ "$KB_PROMO" != "0" ] && [ -n "$KB_PROMO" ]; then
  ALERTS="${ALERTS}  - ナレッジ昇格候補: ${KB_PROMO}件 → 社長に昇格提案すべき\n"
fi

# 未分析プロンプト
UNANALYZED=$(echo "$RESULT" | jq -r '.sources.ceo_insights.unanalyzed_prompts // "0"' 2>/dev/null)
if [ "$UNANALYZED" != "0" ] && [ "$UNANALYZED" != "?" ] && [ -n "$UNANALYZED" ]; then
  ALERTS="${ALERTS}  - 未分析プロンプト: ${UNANALYZED}件\n"
fi

if [ -n "$ALERTS" ]; then
  # additionalContext で報告 + 自動修復を指示
  cat <<EOF
{
  "additionalContext": "データ鮮度アラート（自動修復指示）:\n${ALERTS}\nIMPORTANT: 上記のstaleデータに対して以下を自動実行してください（社長への確認不要）:\n- CEO分析がstale → prompt_logからceo_insightsを生成してSupabaseに保存\n- 部署評価がstale → 現在のデータで評価レポートを生成して .company/hr/evaluations/ に保存\n- 情報収集がstale → 情報収集部Agentを起動して最新ニュースを収集\n- ナレッジ昇格候補がある → 社長に昇格提案を提示\nこれらはブリーフィングの一部として実行し、結果を報告してください。"
}
EOF
fi

exit 0
