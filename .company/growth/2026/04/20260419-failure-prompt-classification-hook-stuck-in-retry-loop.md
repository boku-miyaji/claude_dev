# Prompt classification hook stuck in retry loop

- **type**: `failure`
- **date**: 2026-04-19
- **category**: process / **severity**: medium
- **status**: recurring
- **source**: manual
- **tags**: auto-detected, daily-batch
- **parent_id**: `4d092e0e-2ab7-4930-8c5a-766b08114961`

## what_happened
The same [correction] signal ('Classify each prompt...') fired 20 consecutive times with identical truncated content, indicating a hook or automated process repeatedly attempted prompt classification without completing successfully

## root_cause
A growth-detector or prompt-log hook is emitting a classification instruction as a correction signal on every prompt, but the output never satisfies the hook's success condition — likely because the prompt is truncated (cuts off at 'rikyu/c'), the hook re-fires on its own correction output, or the hook lacks an exit/dedup guard

## countermeasure
Add idempotency to the hook: track already-processed prompt IDs and skip re-classification. Also check the hook script for truncated prompt text (the tag list is cut off mid-word) and ensure the correction output is not itself triggering another hook invocation (self-referential loop)

<!-- id: eaa9432e-c005-4bc7-ae53-b273aec35fd1 -->
