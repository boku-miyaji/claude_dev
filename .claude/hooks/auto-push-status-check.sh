#!/bin/bash
# Hook: SessionStart → auto-push が前回失敗していたら社長に警告
#
# /tmp/auto-push-status.json に {"status":"failed", ...} があれば理由を表示。
# auto-push.sh が次回成功したらファイルが自動削除されるので、解消後は表示されない。
# このフックは通知のみで、実体に手を加えない（社長が原因を確認・対処してから手動 push）。

set -uo pipefail

STATUS_FILE="/tmp/auto-push-status.json"

# stdin (hook input) を捨てる
cat > /dev/null

[ -f "$STATUS_FILE" ] || exit 0

# jq が無くても基本動作はするように
if command -v jq >/dev/null 2>&1; then
  STATUS=$(jq -r '.status // empty' "$STATUS_FILE" 2>/dev/null)
  TIME=$(jq -r '.time // empty' "$STATUS_FILE" 2>/dev/null)
  UNPUSHED=$(jq -r '.unpushed_count // 0' "$STATUS_FILE" 2>/dev/null)
  ERROR=$(jq -r '.error // empty' "$STATUS_FILE" 2>/dev/null)
else
  STATUS=$(grep -o '"status":"[^"]*"' "$STATUS_FILE" | head -1 | cut -d'"' -f4)
  TIME=$(grep -o '"time":"[^"]*"' "$STATUS_FILE" | head -1 | cut -d'"' -f4)
  UNPUSHED=$(grep -o '"unpushed_count":[0-9]*' "$STATUS_FILE" | head -1 | cut -d':' -f2)
  ERROR=""
fi

[ "$STATUS" = "failed" ] || exit 0

echo ""
echo "⚠️  auto-push が失敗したまま残っています"
echo "   時刻: ${TIME}"
echo "   未 push のローカルコミット: ${UNPUSHED}件"
if [ -n "$ERROR" ]; then
  # 長すぎるエラーは省略
  ERROR_PREVIEW=$(printf '%s' "$ERROR" | head -c 400)
  echo "   理由（先頭400文字）:"
  printf '%s\n' "$ERROR_PREVIEW" | sed 's/^/     /'
fi
echo ""
echo "   原因の多くは pre-push gate（typecheck / vitest）の失敗です。"
echo "   対処: 失敗の根本原因を直して \`git push\` し直すと、このアラートは自動で消えます。"
echo "   全ステータス: cat $STATUS_FILE"
echo ""

exit 0
