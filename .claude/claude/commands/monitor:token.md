---
allowed-tools: >
  Bash(claude-monitor:*),
  Bash(ccusage:*),
  Bash(npm:*),
  Bash(pip:*),
  Bash(uv:*),
  Bash(echo:*)
description: |
  Launch the real-time token-usage monitor.
  Example: `/monitor:token --plan max20 --timezone Asia/Tokyo`
---

## Ensure CLI is installed
```bash
command -v claude-monitor || npm install -g ccusage
pip show rich pytz >/dev/null 2>&1 || pip install rich pytz
```

## Start monitor
```bash
claude-monitor $ARGUMENTS
```
