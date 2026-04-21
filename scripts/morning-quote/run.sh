#!/bin/bash
# run.sh
#
# GitHub Actions / 手動実行用のエントリポイント。
#
# Env:
#   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_INGEST_KEY (必須)
#   FOCUS_YOU_USER_ID (オプション、未設定時は "NULL" = 単一ユーザー運用)
#   TARGET_DATE (オプション、未設定時は today JST)
#
# 将来: 複数ユーザー対応時は SELECT DISTINCT user_id FROM diary_entries でループ

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# JST の今日
TODAY=${TARGET_DATE:-$(TZ=Asia/Tokyo date +%Y-%m-%d)}
USER_ID=${FOCUS_YOU_USER_ID:-NULL}

echo "[morning-quote] run: date=$TODAY user=$USER_ID"
bash "${SCRIPT_DIR}/generate-for-day.sh" "$USER_ID" "$TODAY"
