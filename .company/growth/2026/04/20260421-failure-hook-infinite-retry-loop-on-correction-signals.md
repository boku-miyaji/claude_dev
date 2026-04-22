# Hook infinite retry loop on correction signals

- **type**: `failure`
- **date**: 2026-04-21
- **category**: process / **severity**: medium
- **status**: recurring
- **source**: manual
- **tags**: auto-detected, daily-batch
- **parent_id**: `4d092e0e-2ab7-4930-8c5a-766b08114961`

## what_happened
A growth-signal or correction-detection hook fired the same 'Classify each prompt' instruction 200+ times in a loop, followed by the 'Analyze failure signals' prompt also looping. The hook never broke out of its retry cycle.

## root_cause
The hook that detects correction signals and triggers analysis is itself generating correction signals (its own output gets classified as a correction), creating a self-referential infinite loop. Each failed or incomplete analysis attempt is logged as a new correction signal, which triggers another analysis attempt.

## countermeasure
Add a deduplication guard to the hook: skip processing if the signal content matches the hook's own output template (e.g. starts with 'Classify each prompt' or 'Analyze these failure signals'). Alternatively, add a max-retry cap (e.g. 3 attempts) with a cooldown period, and exclude hook-generated prompts from the correction signal source.

<!-- id: 8f3c7c86-2fed-4c5b-bcb9-cb01c4eae41f -->
