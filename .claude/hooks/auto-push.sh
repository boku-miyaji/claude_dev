#!/bin/bash
# Hook: Stop → auto commit & push uncommitted changes
# Runs at session end so work is never lost.
# Designed to NOT interfere with explicit commits by Claude Code.

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
PROJECT_DIR="${CWD:-/workspace}"

cd "$PROJECT_DIR" || exit 0
git remote -v &>/dev/null || exit 0

# push 失敗を /tmp/auto-push-status.json に記録（pre-push gate ブロック等）。
# 成功したらファイルを消して古い失敗状態をクリア。
# SessionStart の auto-push-status-check.sh が次セッション開始時に警告を表示する。
push_with_status() {
  local push_log push_rc commit_sha unpushed
  push_log=$(git push origin main 2>&1)
  push_rc=$?
  if [ $push_rc -ne 0 ]; then
    commit_sha=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
    unpushed=$(git log origin/main..HEAD --oneline 2>/dev/null | wc -l | tr -d ' ')
    if command -v jq >/dev/null 2>&1; then
      jq -n \
        --arg time "$(date -Iseconds)" \
        --arg error "$push_log" \
        --arg sha "$commit_sha" \
        --argjson n "${unpushed:-0}" \
        '{status:"failed", time:$time, error:$error, commit_sha:$sha, unpushed_count:$n, branch:"main"}' \
        > /tmp/auto-push-status.json 2>/dev/null
    else
      printf '{"status":"failed","time":"%s","commit_sha":"%s","unpushed_count":%s,"branch":"main"}' \
        "$(date -Iseconds)" "$commit_sha" "${unpushed:-0}" \
        > /tmp/auto-push-status.json
    fi
  else
    rm -f /tmp/auto-push-status.json
  fi
  return $push_rc
}

# Skip if a commit was made very recently (within 30 seconds)
# This prevents auto-save from racing with Claude Code's explicit commits
LAST_COMMIT_TIME=$(git log -1 --format=%ct 2>/dev/null || echo 0)
NOW=$(date +%s)
if [ $((NOW - LAST_COMMIT_TIME)) -lt 30 ]; then
  # Recent explicit commit exists — just push it if needed
  push_with_status || true
  exit 0
fi

# Check for uncommitted changes (tracked files only)
if git diff --quiet HEAD 2>/dev/null && git diff --cached --quiet HEAD 2>/dev/null; then
  # No changes to tracked files — still push any unpushed commits
  UNPUSHED=$(git log origin/main..HEAD --oneline 2>/dev/null | wc -l)
  if [ "$UNPUSHED" -gt 0 ]; then
    push_with_status || true
  fi
  exit 0
fi

# Stage tracked changes
git add -u 2>/dev/null || exit 0

# Stage safe untracked files so newly created sources are auto-committed too.
# .gitignore already filters out scratch/ and build artifacts; we add a defensive
# pattern + size filter here to avoid committing secrets, DB files, or huge binaries.
git ls-files --others --exclude-standard -z 2>/dev/null | while IFS= read -r -d '' file; do
  [ -z "$file" ] && continue
  case "$file" in
    *.env|*.env.*|*credentials*|*token.json|*.key|*.pem|*.p12|*.pfx) continue ;;
    *secret*|*private*) continue ;;
    *.sqlite|*.sqlite3|*.db) continue ;;
    *.mp4|*.mov|*.zip|*.tar|*.gz|*.tgz|*.7z|*.rar) continue ;;
    # Office / docs — usually client deliverables or received materials, not source.
    # Let the user add these explicitly when they are part of the deliverable.
    *.pptx|*.ppt|*.docx|*.doc|*.xlsx|*.xls|*.pdf) continue ;;
    # Client-received materials
    */受領資料/*|*/received/*|*/client-materials/*) continue ;;
  esac
  # Skip files larger than 5MB (large binaries, datasets, model weights)
  size=$(stat -c%s -- "$file" 2>/dev/null || echo 0)
  [ "$size" -gt 5242880 ] && continue
  git add -- "$file" 2>/dev/null || true
done

# Safety: unstage anything that still looks like secrets or dangerous files
# (second line of defense in case the untracked filter above missed something)
DANGEROUS_PATTERNS=(.env .env.* credentials* token.json *.key *.pem *.p12 *.pfx)
for pat in "${DANGEROUS_PATTERNS[@]}"; do
  git diff --cached --name-only 2>/dev/null | grep -i "$pat" | while read -r f; do
    git reset HEAD -- "$f" 2>/dev/null || true
  done
done

# Safety (large files & build artifacts):
# 過去に node_modules / .next 等が誤って tracked になり、push 時に GitHub の
# 100MB 制限に引っかかった事例 (2026-04-27 incident) の再発防止。
# .gitignore で防げない「すでに tracked」のケースを commit 直前で水際ブロック。
LARGE_FILE_THRESHOLD=$((45 * 1024 * 1024))  # 45MB（GitHub の 50MB 警告ラインの手前）
BLOCKED_FILES=""
while IFS= read -r f; do
  [ -z "$f" ] && continue
  block_reason=""
  case "$f" in
    */node_modules/*|node_modules/*) block_reason="node_modules" ;;
    */.next/*|.next/*)               block_reason=".next-build" ;;
    */dist/*|dist/*)                 block_reason="dist" ;;
    */build/*|build/*)               block_reason="build" ;;
    *.tsbuildinfo)                   block_reason="tsbuildinfo" ;;
    *.log)                           block_reason="log" ;;
  esac
  if [ -z "$block_reason" ] && [ -f "$f" ]; then
    size=$(stat -c%s -- "$f" 2>/dev/null || echo 0)
    if [ "$size" -gt "$LARGE_FILE_THRESHOLD" ]; then
      block_reason="oversize:$((size / 1024 / 1024))MB"
    fi
  fi
  if [ -n "$block_reason" ]; then
    git reset HEAD -- "$f" 2>/dev/null || true
    BLOCKED_FILES="${BLOCKED_FILES}${f} [${block_reason}]\n"
  fi
done < <(git diff --cached --name-only 2>/dev/null)

# blocked があれば /tmp に記録（次セッションで検知できるように）
if [ -n "$BLOCKED_FILES" ]; then
  if command -v jq >/dev/null 2>&1; then
    jq -n \
      --arg time "$(date -Iseconds)" \
      --arg blocked "$(printf '%b' "$BLOCKED_FILES")" \
      '{status:"blocked", time:$time, message:"auto-save が build/cache/巨大ファイルを除外しました。.gitignore 整備を推奨", blocked:$blocked}' \
      > /tmp/auto-push-blocked.json 2>/dev/null
  fi
fi

# Double-check there's something staged
if git diff --cached --quiet HEAD 2>/dev/null; then
  exit 0
fi

# Commit
git commit -m "chore: auto-save session changes

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>" 2>/dev/null || exit 0

# Push (non-blocking, don't fail the hook). 失敗は /tmp/auto-push-status.json に記録される
push_with_status || true

exit 0
