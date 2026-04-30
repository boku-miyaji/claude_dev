# auto-push が SSH 名前解決失敗で20件未push

- **type**: `failure`
- **date**: 2026-04-30
- **category**: devops / **severity**: high
- **status**: active
- **source**: detector
- **tags**: claude-dev, auto-push, hook, auto-detected, daily-batch, llm-classified

## what_happened
SessionStart hook で auto-push が失敗し、未push のローカルコミットが20件残存。原因は ssh: Could not resolve hostname github.com (Temporary failure in name resolution)。前回解決したはずのアラートが再発し、解決後に消える運用になっていなかった点も問題。

## root_cause
DNS解決失敗（一時的なネットワーク障害）に加え、auto-push アラートのライフサイクル管理が不完全で解決済みでも残存する

<!-- id: a91d441b-9362-4af4-ab6f-27952f179b00 -->
