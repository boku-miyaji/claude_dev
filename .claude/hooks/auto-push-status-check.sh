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

# blocked.json: auto-push.sh が build/cache/巨大ファイルを除外したことを通知
BLOCKED_FILE="/tmp/auto-push-blocked.json"
if [ -f "$BLOCKED_FILE" ]; then
  echo ""
  echo "⚠️  auto-save が一部ファイルを commit から除外しました"
  if command -v jq >/dev/null 2>&1; then
    jq -r '.blocked // empty' "$BLOCKED_FILE" 2>/dev/null | sed 's/^/   /'
  else
    grep -o '"blocked":"[^"]*"' "$BLOCKED_FILE" | head -1 | cut -d'"' -f4 | sed 's/^/   /'
  fi
  echo ""
  echo "   理由: GitHub の 100MB 制限超過 / build artifacts (node_modules・.next 等) は履歴に入れない方針"
  echo "   対処: .gitignore に該当パスを追加してください（既存なら .git のキャッシュを clear）"
  echo ""
  rm -f "$BLOCKED_FILE"
fi

[ -f "$STATUS_FILE" ] || exit 0

# jq が無くても基本動作はするように
if command -v jq >/dev/null 2>&1; then
  STATUS=$(jq -r '.status // empty' "$STATUS_FILE" 2>/dev/null)
  TIME=$(jq -r '.time // empty' "$STATUS_FILE" 2>/dev/null)
  UNPUSHED=$(jq -r '.unpushed_count // 0' "$STATUS_FILE" 2>/dev/null)
  ERROR=$(jq -r '.error // empty' "$STATUS_FILE" 2>/dev/null)
  BRANCH=$(jq -r '.branch // "main"' "$STATUS_FILE" 2>/dev/null)
else
  STATUS=$(grep -o '"status":"[^"]*"' "$STATUS_FILE" | head -1 | cut -d'"' -f4)
  TIME=$(grep -o '"time":"[^"]*"' "$STATUS_FILE" | head -1 | cut -d'"' -f4)
  UNPUSHED=$(grep -o '"unpushed_count":[0-9]*' "$STATUS_FILE" | head -1 | cut -d':' -f2)
  ERROR=""
  BRANCH=$(grep -o '"branch":"[^"]*"' "$STATUS_FILE" | head -1 | cut -d'"' -f4)
fi

[ "$STATUS" = "failed" ] || exit 0

# === Self-heal: 既に push 済なら警告を出さずファイルごと片付ける ===
# 別経路（Mac 側 push、別セッションの auto-push 成功、手動 push 等）で sync 済みのケースを検知する。
# cwd が git repo で、記録された branch がローカルに存在する場合のみ判定する。
# 確認できない場合は安全側に倒して従来通り警告する。
if [ -n "${BRANCH:-}" ] && git rev-parse --git-dir >/dev/null 2>&1 \
   && git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
  # remote 状態を最新化（5秒以内、失敗・ネットワーク不在は許容）
  timeout 5 git fetch --quiet origin "$BRANCH" 2>/dev/null || true
  UNPUSHED_NOW=$(git rev-list --count "${BRANCH}@{u}..${BRANCH}" 2>/dev/null || echo "")
  if [ "$UNPUSHED_NOW" = "0" ]; then
    rm -f "$STATUS_FILE"
    exit 0
  fi
fi
# === Self-heal ここまで ===

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
