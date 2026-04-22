# Batch classification/analysis prompts misclassified as corrections

- **type**: `failure`
- **date**: 2026-04-12
- **category**: process / **severity**: medium
- **status**: active
- **source**: manual
- **tags**: auto-detected, daily-batch, claude-dev

## what_happened
Automated batch prompts (prompt classifier and failure-signal analyzer) are being logged as [correction] signals, flooding the failure signal buffer with 386 entries that are actually normal system invocations.

## root_cause
The signal detector likely flags any prompt containing keywords like 'Classify', 'Analyze', or 'failure' as a correction/failure signal, without excluding internal batch/hook-driven prompts from the growth-detector or analysis pipeline.

## countermeasure
Add an allowlist in the signal detector to skip internal system prompts (match on known prefixes like 'Classify each prompt' and 'Analyze these failure signals'), or tag hook-originated prompts with a source field and exclude source=system from correction classification.

<!-- id: 83097799-2ec6-4b34-a475-e4b6e8c93d5b -->
