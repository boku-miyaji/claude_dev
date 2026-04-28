# 全 workflow の actions/setup-node SHA を v4 正規 SHA に修正 + 失敗検知の仕組み導入

- **type**: `countermeasure`
- **date**: 2026-04-27
- **category**: devops / **severity**: high
- **status**: active
- **source**: manual
- **tags**: claude-dev, github-actions, sha-pinning, workflow, batch, silent-failure, manual-record
- **parent_id**: `d521941e-cd5f-48ce-8a11-0833e9c85b9f`

## what_happened
setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 (v4) に 4 workflow を一括修正 (morning-quote / narrator-update / news-collect / proactive-prep)。再発防止として scripts/growth/check-workflow-failures.sh を新設し、過去24h で failure になった workflow を自動的に growth_events に failure として INSERT する仕組みを導入。daily-growth-digest 系 cron に組み込み、ブリーフィングで翌朝検知できるようにする。

## countermeasure
(1) 即時: setup-node SHA を全 workflow で正規値に修正。(2) 構造: 失敗検知バッチで silent failure を翌日ブリーフィングに浮上。(3) 横展開: setup-node のような multi-action 同SHA pinning を pre-commit で検出（次フェーズ）。

## result
ブリーフィングで気付く前に手動依頼で発覚したため、検知遅延 6 日。仕組み導入後は最大 24 時間で気付ける想定。

<!-- id: 9497917a-4d11-4106-8c34-28882b1f7e51 -->
