# Hook infinite loop: correction signals repeating themselves

- **type**: `failure`
- **date**: 2026-04-19
- **category**: process / **severity**: medium
- **status**: recurring
- **source**: manual
- **tags**: auto-detected, daily-batch, agent-harness
- **parent_id**: `4d092e0e-2ab7-4930-8c5a-766b08114961`

## what_happened
52 correction signals accumulated, all containing the same two truncated prompts repeating in a loop — a classify-prompts hook and an analyze-failures hook keep firing on each other's output

## root_cause
A PostToolUse or Stop hook is generating correction signals that themselves trigger the same hook again, creating a feedback loop. The classify and analyze prompts are being injected as UserPromptSubmit hooks, and each hook's output is detected as a new prompt requiring classification/analysis

## countermeasure
Add a guard to the hook scripts to skip processing when the input prompt starts with their own prefix (e.g. 'Classify each prompt' or 'Analyze these failure signals'). Alternatively, filter out hook-generated prompts from the growth-signals log before feeding them back into analysis

<!-- id: 6035cb9e-db63-48ab-8a65-24e113e90205 -->
