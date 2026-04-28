# auto-save が node_modules / .next を tracked → push 100MB reject

- **type**: `failure`
- **date**: 2026-04-27
- **category**: devops / **severity**: high
- **status**: active
- **source**: manual
- **tags**: claude-dev, git, build, node-modules, auto-push, manual-record

## what_happened
rikyu repo で 14 commits push 失敗。原因: server/node_modules/next-swc.linux-x64-gnu.node (113MB) と server/.next/dev/cache/turbopack/*.sst (50-84MB が多数) が過去の auto-save commit に含まれていた。GitHub の 100MB 制限で pre-receive hook reject。

## root_cause
.gitignore に server/node_modules/ と server/.next/ が無かった。auto-push.sh の 5MB 制限は untracked のみが対象で、既に tracked のファイルはすり抜けていた。

<!-- id: 577afc1b-f433-472d-bfbf-3b9495e92e21 -->
