---
allowed-tools: >
  Bash(gh pr reviews:*),
  Bash(git add:*),
  Bash(git commit:*),
  Bash(git push:*),
  Bash(echo:*),
  Bash(jq:*)
description: |
  Address all open review comments on current PR and push fixes.
---

## Current review threads
!`gh pr reviews --json author,body,state,threadResolutionState`

## Process
For each **CHANGES_REQUESTED** thread:
1. Apply fix.
2. Mark resolved  
   ```bash
   gh pr review --comment-id <id> --body "Resolved"
   ```
3. After all fixes  
   ```bash
   git add .
   git commit -m "fix: address review feedback"
   git push
   ```

### Return
```
👍 All review comments resolved & pushed
```
