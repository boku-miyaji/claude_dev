# auto-push.sh に build/cache 水際ブロック + .gitignore 必須項目をルール化

- **type**: `countermeasure`
- **date**: 2026-04-27
- **category**: devops / **severity**: high
- **status**: active
- **source**: manual
- **tags**: claude-dev, git, build, auto-push, gitignore-policy, manual-record
- **parent_id**: `577afc1b-f433-472d-bfbf-3b9495e92e21`

## countermeasure
3層防御: (1) .gitignore に **/node_modules/ **/.next/ **/dist/ **/build/ *.tsbuildinfo を必須化（全PJ共通）。(2) .claude/hooks/auto-push.sh に commit 直前の水際ブロックを追加：node_modules/.next/dist/build/*.tsbuildinfo パスと 45MB超ファイルを stage から reset。(3) SessionStart hook (auto-push-status-check.sh) で除外発生時に警告通知。.claude/rules/commit-rules.md に運用手順を文書化。

## result
auto-push.sh c5f21bf / commit-rules.md 457b439 で実装済み。次回以降の auto-save で node_modules / .next が誤って tracked になっても commit 前に弾かれる。

<!-- id: 687da31c-fd90-448e-85d6-b130aa4f4721 -->
