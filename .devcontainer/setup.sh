#!/bin/bash
# Rebuild後も tmuxc/tmuxd を ~/.zshrc に保持する（冪等）
if ! grep -q "tmuxc" ~/.zshrc; then
  cat >> ~/.zshrc << 'EOF'

# --- tmuxc / tmuxd: バックグラウンドでclaude実行 ---
function tmuxc() {
    if [ -z "$1" ]; then
        local sessions
        sessions=$(tmux ls -F '#{session_name}' 2>/dev/null)
        if [ -z "$sessions" ]; then echo "No sessions"; return 1; fi
        echo "$sessions" | nl -w2 -s') '
        echo -n "Connect to (number): "
        read num
        local name=$(echo "$sessions" | sed -n "${num}p")
        [ -n "$name" ] && tmux attach-session -t "$name"
    else
        local name="$1"
        if tmux has-session -t "$name" 2>/dev/null; then
            tmux attach-session -t "$name"
        else
            tmux new-session -d -s "$name" -c "$PWD"
            tmux send-keys -t "$name" "claude" Enter
            tmux attach-session -t "$name"
        fi
    fi
}

function tmuxd() {
    local sessions
    sessions=$(tmux ls -F '#{session_name}' 2>/dev/null)
    if [ -z "$sessions" ]; then echo "No sessions"; return 1; fi
    if [ -z "$1" ]; then
        echo "$sessions" | nl -w2 -s') '
        echo -n "Delete (number): "
        read num
        local name=$(echo "$sessions" | sed -n "${num}p")
        [ -n "$name" ] && tmux kill-session -t "$name" && echo "Deleted: $name"
    else
        tmux kill-session -t "$1" && echo "Deleted: $1"
    fi
}

alias tmuxcl='tmux ls 2>/dev/null || echo "No sessions"'
EOF
  echo "✓ tmuxc/tmuxd added to ~/.zshrc"
fi
