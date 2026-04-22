# Prompt classification task stuck in correction loop

- **type**: `failure`
- **date**: 2026-04-11
- **category**: process / **severity**: medium
- **status**: active
- **source**: manual
- **tags**: auto-detected, daily-batch, claude-dev

## what_happened
A prompt classification task ('[correction] Classify each prompt...') fired repeatedly (13+ times) without successful completion, followed by recursive analysis requests

## root_cause
The classification task's JSON output was incomplete or malformed, triggering the correction system repeatedly. Each correction re-triggered the same task, creating a feedback loop that never resolved

## countermeasure
Complete the classification task once with valid, complete JSON output for all prompts, ensuring proper format before returning. Verify each JSON object has required fields (id, tags) and is syntactically valid before submitting. Check for any hook or automation rule causing re-triggering, and disable if necessary.

<!-- id: dcf51848-fa17-41d9-9076-33a4300286d9 -->
