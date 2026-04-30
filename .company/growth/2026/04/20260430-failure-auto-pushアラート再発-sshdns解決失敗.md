# auto-pushアラート再発 (SSH/DNS解決失敗)

- **type**: `failure`
- **date**: 2026-04-30
- **category**: automation / **severity**: high
- **status**: active
- **source**: detector
- **tags**: claude-dev, hook, auto-push, git, auto-detected, daily-batch, llm-classified

## what_happened
SessionStartで auto-push が未push 21コミットのまま残るアラートが再発。前回SSH キー権限問題で解決済みのはずが、今回は ssh: Could not resolve hostname github.com (DNS解決失敗)。解決時のアラート消去フローが機能していない疑い。

## root_cause
DNS解決失敗 + 解決時アラート自動消去機構の不備

<!-- id: 61eba60e-bbb2-477f-8950-03081176914c -->
