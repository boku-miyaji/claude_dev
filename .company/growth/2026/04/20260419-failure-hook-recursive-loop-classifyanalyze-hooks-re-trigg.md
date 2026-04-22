# Hook recursive loop: classify/analyze hooks re-triggering themselves

- **type**: `failure`
- **date**: 2026-04-19
- **category**: process / **severity**: medium
- **status**: recurring
- **source**: manual
- **tags**: auto-detected, daily-batch, agent-harness
- **parent_id**: `4d092e0e-2ab7-4930-8c5a-766b08114961`

## what_happened
157 correction signals dominated by two repeating patterns: 'Classify each prompt' and 'Analyze failure signals' prompts firing repeatedly. The same hook output is being fed back as input, creating an infinite loop. Two actual user corrections ('Magentic実装やり直し') are buried in noise.

## root_cause
A UserPromptSubmit or Stop hook (likely growth-detector or prompt-classifier) emits output that itself gets captured as a new signal/prompt, triggering the same hook again recursively. The 'Analyze failure signals' prompt is this very analysis task also being captured as a correction signal, compounding the loop.

## countermeasure
Add a guard clause to the triggering hook: skip processing if the prompt content matches the hook's own output pattern (e.g., starts with 'Classify each prompt' or 'Analyze these failure signals'). Alternatively, set an environment variable (e.g., HOOK_RUNNING=1) before hook execution and check it at entry to prevent re-entrance.

<!-- id: 4de32759-b65f-4ccb-839d-2d94dabcce38 -->
