---
allowed-tools: >
  Bash(claude-flow spawn:*),
  Bash(claude-flow agents list:*),
  Bash(node:*),
  Bash(echo:*)
description: |
  Spin up a SPARC agent via claude-flow.
  First arg = agent name (e.g. architect, tdd).
  Remaining text → prompt.
---

## Recent agents
!`claude-flow agents list --limit 5`

## Execute
```bash
claude-flow spawn $ARGUMENTS
```

Wait for “✅ ready” then return:
```
🚀 Spawned SPARC agent '<agent_name>' (session-id: <id>)
```
