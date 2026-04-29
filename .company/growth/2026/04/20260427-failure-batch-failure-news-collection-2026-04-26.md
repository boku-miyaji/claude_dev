# [batch failure] News Collection (2026-04-26)

- **type**: `failure`
- **date**: 2026-04-27
- **category**: devops / **severity**: high
- **status**: resolved
- **source**: manual
- **tags**: claude-dev, github-actions, batch, silent-failure, manual-record
- **parent_id**: `8e7abbc6-5587-4082-b7a5-a23c29b046a3`

## what_happened
GitHub Actions workflow 'News Collection' failed at 2026-04-26T21:49:06Z. Run URL: https://github.com/boku-miyaji/claude_dev/actions/runs/24967891762. Diagnose with: gh run view 24967891762 --log-failed

## root_cause
#8e7abbc6 参照: auto-save が sources.yaml を flow → block 形式に reformat したため check-arxiv-sync.sh の regex がマッチせず exit 1 となった。

## countermeasure
#8e7abbc6 と同一事象（check-arxiv-sync.sh の YAML format 不一致）。fix commit 44389e6c で解消済み。次回 schedule run で検証。

<!-- id: cf402904-00b0-446b-838b-4c4c1ab9888b -->
