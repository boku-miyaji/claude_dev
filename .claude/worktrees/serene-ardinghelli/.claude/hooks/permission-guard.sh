#!/bin/bash
# Hook: PermissionRequest → 権限レベルに基づいて自動判定
# /permission スキルが書き込む permission-level.conf を読み、
# full/safe/strict に応じて allow/deny を返す。
#
# 返り値 (stdout JSON):
#   {"behavior": "allow"}                          → 自動許可（ダイアログ出ない）
#   {"behavior": "deny"}                           → 自動拒否
#   hookSpecificOutput + destination: "session"     → セッション内のみ許可（ファイルに残らない）
#   空 or exit 0                                    → 通常のダイアログ表示
#
# 設計思想:
#   settings.json はgit管理の共通設定。settings.local.json はサーバー固有。
#   Hookで自動許可する場合は destination: "session" で許可し、
#   settingsファイルにゴミが溜まるのを防ぐ。

set -euo pipefail

CONF_DIR="$(cd "$(dirname "$0")" && pwd)"
LEVEL_FILE="$CONF_DIR/permission-level.conf"

# レベルファイルがなければ何もしない（通常のダイアログ）
if [ ! -f "$LEVEL_FILE" ]; then
  exit 0
fi

LEVEL=$(cat "$LEVEL_FILE" | tr -d '[:space:]')

# 入力を読む
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')

case "$LEVEL" in
  full)
    # 全部許可（セッション内のみ、ファイルに書き込まない）
    echo '{"behavior": "allow"}'
    exit 0
    ;;

  safe)
    # 破壊的操作だけダイアログ、それ以外は自動許可
    COMMAND=""
    if [ "$TOOL_NAME" = "Bash" ]; then
      COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
    fi

    # 破壊的パターンチェック
    DESTRUCTIVE=false
    if [ -n "$COMMAND" ]; then
      case "$COMMAND" in
        *"rm -rf"*|*"rm -r "*) DESTRUCTIVE=true ;;
        *"git push --force"*|*"git push -f"*) DESTRUCTIVE=true ;;
        *"git reset --hard"*) DESTRUCTIVE=true ;;
        *"git clean"*) DESTRUCTIVE=true ;;
        *"git branch -D"*) DESTRUCTIVE=true ;;
        *"DROP TABLE"*|*"drop table"*) DESTRUCTIVE=true ;;
        *"TRUNCATE"*|*"truncate "*) DESTRUCTIVE=true ;;
        *"kill -9"*|*"pkill "*) DESTRUCTIVE=true ;;
        *"chmod 777"*) DESTRUCTIVE=true ;;
        *"mkfs"*) DESTRUCTIVE=true ;;
        *"> /dev/"*) DESTRUCTIVE=true ;;
      esac
    fi

    if [ "$DESTRUCTIVE" = "true" ]; then
      # 破壊的操作 → 通常のダイアログ表示（ユーザー判断）
      exit 0
    else
      # 安全 → セッション内のみ自動許可
      echo '{"behavior": "allow"}'
      exit 0
    fi
    ;;

  strict)
    # strict では Hook は介入しない → 通常のダイアログ
    # settings.json の allow リストのみに基づく
    exit 0
    ;;

  *)
    # 不明なレベル → 何もしない
    exit 0
    ;;
esac
