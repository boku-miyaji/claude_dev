# Hook infinite retry loop on classification prompt

- **type**: `failure`
- **date**: 2026-04-17
- **category**: process / **severity**: medium
- **status**: active
- **source**: manual
- **tags**: auto-detected, daily-batch

## what_happened
A hook (likely growth-detector or prompt-log) repeatedly fires the same classification/analysis prompt on every response, generating 25 identical correction signals in a single session

## root_cause
The hook's output is being treated as a new user prompt or correction, causing it to re-trigger itself in an infinite loop. The classification prompt and the analysis prompt are both being injected by hooks (UserPromptSubmit or Stop) and each re-invocation generates another signal

## countermeasure
Add a guard in the hook to skip execution when the input prompt matches its own output pattern (e.g. starts with 'Classify each prompt' or 'Analyze these failure signals'). Use a lockfile or environment variable to prevent re-entrant invocation within the same response cycle

<!-- id: 76b002a7-9d4e-4e49-9d32-003e67abad7c -->
