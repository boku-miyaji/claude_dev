#!/bin/bash
# Hook: SessionStop — Edge Functionに変更があれば自動デプロイ
# async: true
# ai-agent/index.ts が直近のセッションで変更されていたらデプロイする

set -uo pipefail

FUNC_FILE="/workspace/company-dashboard/supabase/functions/ai-agent/index.ts"
MARKER="/tmp/claude-edge-function-last-deploy"
PROJECT_REF="akycymnahqypmtsfqhtr"

# ファイルが存在しなければスキップ
[ -f "$FUNC_FILE" ] || exit 0

# 最終変更時刻を取得
FILE_MTIME=$(stat -c %Y "$FUNC_FILE" 2>/dev/null || echo 0)

# 前回デプロイ時刻と比較
LAST_DEPLOY=0
[ -f "$MARKER" ] && LAST_DEPLOY=$(cat "$MARKER")

if [ "$FILE_MTIME" -le "$LAST_DEPLOY" ]; then
  exit 0  # 変更なし
fi

# Supabase Access Token を取得
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/supabase.env" 2>/dev/null || true

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "[edge-deploy] SUPABASE_ACCESS_TOKEN not found, skipping" >&2
  exit 0
fi

# デプロイ実行
cd /workspace/company-dashboard
export SUPABASE_ACCESS_TOKEN
npx supabase functions deploy ai-agent --no-verify-jwt --project-ref "$PROJECT_REF" 2>&1 | tail -3

if [ $? -eq 0 ]; then
  echo "$FILE_MTIME" > "$MARKER"
  echo "[edge-deploy] ai-agent deployed successfully" >&2
else
  echo "[edge-deploy] deploy failed" >&2
fi

exit 0
