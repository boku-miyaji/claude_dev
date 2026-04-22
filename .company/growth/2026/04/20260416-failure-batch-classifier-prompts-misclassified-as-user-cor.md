# Batch classifier prompts misclassified as user corrections

- **type**: `failure`
- **date**: 2026-04-16
- **category**: process / **severity**: medium
- **status**: active
- **source**: manual
- **tags**: auto-detected, daily-batch

## what_happened
A growth/correction detector repeatedly flagged automated batch prompts (prompt classification and failure-signal analysis) as user 'correction' signals, producing 31 duplicate false-positive entries.

## root_cause
The correction detector matches on prompt content heuristics without excluding system/batch-originated prompts, so recurring internal analysis jobs get logged as user feedback corrections.

## countermeasure
Add a source/role filter to the correction detector: skip prompts originating from hooks, batch jobs, or known system prompt prefixes (e.g. 'Classify each prompt', 'Analyze these failure signals'), and require an interactive user session before recording a correction signal.

<!-- id: e453eadf-e30d-4da5-86f7-de80487eb71d -->
