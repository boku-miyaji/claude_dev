#!/bin/bash
# Hook: SessionStart — セッション開始マーカーを作成
# session-summary.sh が「今セッションで変更されたファイル」を検出するための基準点

touch /tmp/.claude-session-start
exit 0
