# Hook recursive loop: correction signals feed back into themselves

- **type**: `failure`
- **date**: 2026-04-19
- **category**: process / **severity**: medium
- **status**: recurring
- **source**: manual
- **tags**: auto-detected, daily-batch, agent-harness
- **parent_id**: `4d092e0e-2ab7-4930-8c5a-766b08114961`

## what_happened
157 correction signals accumulated, dominated by two repeated prompts: 'Classify each prompt...' and 'Analyze these failure signals...'. The same classification/analysis prompt fires repeatedly without producing a usable result, drowning out the 2-3 actual user corrections (Magentic implementation requests).

## root_cause
A growth-detector or prompt-classification hook is emitting correction signals that themselves get re-classified as new correction signals, creating a feedback loop. The 'Analyze these failure signals' prompt appearing as a correction signal confirms the analysis hook's own output is being re-ingested as input.

## countermeasure
Add deduplication and self-reference filtering to the hook: (1) skip signals whose content matches the hook's own prompt template (prevent self-ingestion), (2) deduplicate identical signals before accumulating (the same 'Classify each prompt' fired 14+ times), (3) add a max-fire-per-session cap (e.g. 3) to prevent runaway accumulation.

<!-- id: 5e4e9355-4cf6-47d4-be16-47c95427739f -->
