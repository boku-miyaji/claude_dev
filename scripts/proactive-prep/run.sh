#!/bin/bash
# run.sh
#
# GitHub Actions / 手動実行用のエントリポイント。
#
# 目的:
#   silence-first を維持したまま、Today 上部に「気づいたら準備されている」
#   前奏 (proactive prelude) を 1日1件だけ用意する。シグナルが何も立たない
#   日は何も書き込まない（=Today では非表示のまま）。
#
# Env:
#   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_INGEST_KEY (必須)
#   FOCUS_YOU_USER_ID (オプション、未設定時は "NULL" = 単一ユーザー運用)
#   TARGET_DATE (オプション、未設定時は today JST)
#
# 設計参照:
#   - arXiv:2604.00842 (Pare): proactive agent 4軸
#   - Migration 069: proactive_preparations テーブル
#   - design-philosophy ⑪: 完全な受動表示

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# JST の今日
TODAY=${TARGET_DATE:-$(TZ=Asia/Tokyo date +%Y-%m-%d)}
USER_ID=${FOCUS_YOU_USER_ID:-NULL}

echo "[proactive-prep] run: date=$TODAY user=$USER_ID"
bash "${SCRIPT_DIR}/generate-for-day.sh" "$USER_ID" "$TODAY"
