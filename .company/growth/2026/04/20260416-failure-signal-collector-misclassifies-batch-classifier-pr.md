# Signal collector misclassifies batch classifier prompts as corrections

- **type**: `failure`
- **date**: 2026-04-16
- **category**: process / **severity**: medium
- **status**: active
- **source**: manual
- **tags**: auto-detected, daily-batch, claude-dev

## what_happened
The failure-signal pipeline repeatedly ingested its own batch prompt-classifier and failure-analyzer invocations as [correction] signals, creating a feedback loop of 167 near-duplicate entries.

## root_cause
The signal detector tags any prompt containing keywords like 'Classify'/'Analyze...failure' as a user correction, without excluding system-internal batch jobs, so the classifier's own prompts get logged as corrections to itself.

## countermeasure
Exclude internal batch/meta prompts from correction detection: filter by a known system prompt prefix or marker (e.g. skip prompts originating from the classifier/analyzer scripts), and dedupe identical signals within a short window.

<!-- id: c1bd07cf-644d-4eb4-a6bf-37d85f490a30 -->
