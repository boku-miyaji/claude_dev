#!/bin/bash
# Hook: SessionStart — 部署評価の定期トリガー
# 14日以上評価が実施されていない場合、additionalContext で通知する。
# 前回実行日を記録して、同セッション内の多重発火を防ぐ。

LAST_RUN_FILE="$HOME/.claude/hooks/.dept-eval-last-run"
TODAY=$(date +%Y-%m-%d)

# 同日は再実行しない
[ -f "$LAST_RUN_FILE" ] && [ "$(cat "$LAST_RUN_FILE" 2>/dev/null)" = "$TODAY" ] && exit 0

# --- 最終評価日の取得 ---
EVAL_DIR="/workspace/.company/hr/evaluations"
LAST_EVAL=""

if [ -d "$EVAL_DIR" ]; then
  # ファイル名から日付を抽出 (YYYY-MM-DD-*.md)
  LAST_EVAL=$(ls "$EVAL_DIR"/*.md 2>/dev/null | sed 's/.*\///' | grep -oP '^\d{4}-\d{2}-\d{2}' | sort -r | head -1)
fi

if [ -z "$LAST_EVAL" ]; then
  echo "$TODAY" > "$LAST_RUN_FILE"
  cat <<CONTEXT
{
  "additionalContext": "⚠️ 【部署評価】評価レポートが一度も作成されていません。.company/hr/evaluations/ にファイルがありません。/company で評価を実施してください。"
}
CONTEXT
  exit 0
fi

# --- 経過日数の計算 ---
LAST_EPOCH=$(date -d "$LAST_EVAL" +%s 2>/dev/null)
TODAY_EPOCH=$(date -d "$TODAY" +%s 2>/dev/null)

if [ -z "$LAST_EPOCH" ] || [ -z "$TODAY_EPOCH" ]; then
  exit 0
fi

DAYS_SINCE=$(( (TODAY_EPOCH - LAST_EPOCH) / 86400 ))

echo "$TODAY" > "$LAST_RUN_FILE"

if [ "$DAYS_SINCE" -ge 14 ]; then
  # --- Supabase から部署稼働サマリを取得 ---
  ENV_FILE="$HOME/.claude/hooks/supabase.env"
  DEPT_SUMMARY=""
  if [ -f "$ENV_FILE" ]; then
    source "$ENV_FILE"
    DEPT_SUMMARY=$(curl -s "${SUPABASE_URL}/rest/v1/activity_log?action=eq.dept_dispatch&select=metadata,created_at&order=created_at.desc&limit=100" \
      -H "apikey: ${SUPABASE_ANON_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" 2>/dev/null | \
      python3 -c "
import json, sys
from collections import Counter
try:
    data = json.load(sys.stdin)
    c = Counter()
    for r in data:
        dept = (r.get('metadata') or {}).get('dept', 'unknown')
        if dept and dept != 'Explore':
            c[dept] += 1
    parts = [f'{k}: {v}回' for k,v in c.most_common(10)]
    print(', '.join(parts) if parts else '稼働記録なし')
except:
    print('取得エラー')
" 2>/dev/null)
  fi

  cat <<CONTEXT
{
  "additionalContext": "⚠️ 【部署評価リマインド】前回評価から${DAYS_SINCE}日経過（前回: ${LAST_EVAL}）。14日サイクルを超えています。\n\n部署稼働実績: ${DEPT_SUMMARY}\n\n社長に評価実施を提案してください。評価は .company/hr/evaluations/YYYY-MM-DD-*.md に出力し、Supabase activity_log にも記録します。"
}
CONTEXT
elif [ "$DAYS_SINCE" -ge 10 ]; then
  cat <<CONTEXT
{
  "additionalContext": "📋 部署評価: 前回から${DAYS_SINCE}日経過（${LAST_EVAL}）。あと$((14 - DAYS_SINCE))日で評価サイクル。"
}
CONTEXT
fi

exit 0
