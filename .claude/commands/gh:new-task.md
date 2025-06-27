---
allowed-tools: >
  Bash(gh issue create:*),
  Bash(gh label create:*),
  Bash(gh label list:*),
  Bash(gh project:*),
  Bash(git branch:*),
  Bash(git rev-parse:*),
  Bash(tr:*),
  Bash(sed:*),
  Bash(echo:*),
  Bash(jq:*),
  Bash(cat:*)
description: |
  Create a new GitHub Issue with the given title, add the **task** label,
  put it into the first Projects board (Status = Backlog), then
  create & check out a dev branch
  `issue/<number>-<kebab_title>`.
---

## Context
- Repository root : !`git rev-parse --show-toplevel`
- Current branch  : !`git branch --show-current`
- Auth status     : !`gh auth status -h github.com`
- Existing labels : !`gh label list`

## Steps for Claude 🤖

1. **Ensure label** `task` exists  
   ```bash
   gh label create task --description "General task" --color C2E0C6 --force
   ```

2. **Create Issue**  
   ```bash
   gh issue create \
     --title "$ARGUMENTS" \
     --label task \
     --body "Created via /gh:new-task"
   ```
   Capture returned Issue 番号 → `${ISSUE_N}`.

3. **Add to Projects** (最初のボード) → Status = Backlog

4. **Slug 生成**  
   ```bash
   TITLE_SLUG=$(echo "$ARGUMENTS" | tr '[:upper:]' '[:lower:]' \
                | sed -E 's/[^a-z0-9]+/-/g;s/^-+|-+$//g')
   ```

5. **ブランチ作成**  
   ```bash
   git checkout -b "issue/${ISSUE_N}-${TITLE_SLUG}"
   ```

6. **出力（この 1 行のみ）**  
   ```
   ✅ Created issue #${ISSUE_N} and switched to branch issue/${ISSUE_N}-${TITLE_SLUG}
   ```
