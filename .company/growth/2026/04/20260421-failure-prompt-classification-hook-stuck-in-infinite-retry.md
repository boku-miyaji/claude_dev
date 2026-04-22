# Prompt classification hook stuck in infinite retry loop

- **type**: `failure`
- **date**: 2026-04-21
- **category**: process / **severity**: medium
- **status**: recurring
- **source**: manual
- **tags**: auto-detected, daily-batch
- **parent_id**: `4d092e0e-2ab7-4930-8c5a-766b08114961`

## what_happened
The same correction signal — a prompt classification instruction — fired 213 times identically, indicating a hook or batch process is repeatedly failing and retrying the exact same operation without ever succeeding or backing off.

## root_cause
A growth-detector or prompt-log hook (likely UserPromptSubmit) is sending prompts to an LLM for classification, but the response never satisfies the validation check (e.g., malformed JSON, missing fields, or the prompt itself is being truncated before the full tag list is delivered). Each failure triggers an identical retry with no backoff or attempt limit, creating an infinite loop of identical correction signals.

## countermeasure
Add a max-retry cap (e.g., 3 attempts) and exponential backoff to the classification hook. Log the raw LLM response on failure so the parse error is visible. If the prompt being classified is too long for the context, truncate it before sending. Check growth-signals.jsonl and the hook script for the retry logic.

<!-- id: 7828100d-1227-479d-b532-ef0a06d787f1 -->
