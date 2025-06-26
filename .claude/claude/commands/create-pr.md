---
allowed-tools: >
  Bash(git push:*),
  Bash(gh pr create:*),
  Bash(git rev-parse:*),
  Bash(echo:*)
description: |
  Push branch & open Draft PR linked to the Issue in branch name
  (pattern: issue/<num>-*).
---

## Detect branch & Issue
!`git branch --show-current`

## Steps
```bash
git push --set-upstream origin $(git branch --show-current)
gh pr create --draft \
  --title "$(git branch --show-current | sed 's|issue/||')" \
  --body "Closes #<issue_number>"
```

### Output
```
📨 Draft PR created: <url>
```
