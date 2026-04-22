# Hook recursive loop: classifier/analyzer re-triggering itself

- **type**: `failure`
- **date**: 2026-04-19
- **category**: process / **severity**: medium
- **status**: recurring
- **source**: manual
- **tags**: auto-detected, daily-batch
- **parent_id**: `4d092e0e-2ab7-4930-8c5a-766b08114961`

## what_happened
160 correction signals accumulated, dominated by repeated identical prompts — 'Classify each prompt' and 'Analyze these failure signals' appear dozens of times. A small number of actual user corrections (e.g., Magentic implementation request) are buried under hook-generated noise.

## root_cause
A hook (likely growth-detector or prompt-classifier in UserPromptSubmit/Stop) is emitting prompts that get re-captured as new signals, creating a feedback loop. The hook's own 'Classify each prompt...' and 'Analyze these failure signals...' outputs are being logged back into growth-signals.jsonl as [correction] events, which then trigger further analysis — an infinite recursion pattern.

## countermeasure
Add a guard in the hook to skip processing when the input matches its own output patterns. Specifically: (1) filter out entries where the prompt starts with 'Classify each prompt' or 'Analyze these failure signals' before logging to growth-signals.jsonl, (2) add a source field (e.g., 'source: hook') to hook-generated entries and exclude them from future analysis, (3) deduplicate identical consecutive signals before batch analysis runs.

<!-- id: 1ee8e177-94fc-4a79-b2f2-9c4255a1a1f0 -->
